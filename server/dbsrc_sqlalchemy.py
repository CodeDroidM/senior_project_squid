import base64
import json
import socket
import os
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())


class DbSrcConnector:
    """
    DbSrc client for H2M authentication and SQL query execution.
    Handles agent connection, user authentication, ACCP binding, and SQL queries.
    """

    def __init__(self, host="www.compute-mertjiandata.com", port=9000, agent_password=None):
        self.host = host
        self.port = port
        self.socket = None
        self.agent_password = agent_password or os.environ.get("DBSRC_AGENT_PASSWORD", "dbsrc$admin2024!")
        self.token = None

    def _send_request(self, request):
        """Send a request to the DbSrc agent."""
        msg = json.dumps(request) + "\n"
        self.socket.send(msg.encode("utf-8"))

    def _send_and_receive(self, request):
        """Atomic send+receive operation to prevent buffer contamination.
        
        This ensures each request gets its corresponding response,
        preventing the "broken SQL data" issue where responses get mixed up.
        """
        import time
        
        # CRITICAL FIX: Clear any stale data from the socket buffer before sending new request
        # Set socket to non-blocking temporarily to drain any leftover data
        self.socket.setblocking(False)
        try:
            while True:
                try:
                    stale_data = self.socket.recv(65536)
                    if stale_data:
                        print(f"⚠️ Cleared {len(stale_data)} bytes of stale data from buffer")
                    else:
                        break
                except BlockingIOError:
                    # No more data in buffer - this is what we want
                    break
        finally:
            # Restore blocking mode
            self.socket.setblocking(True)
            self.socket.settimeout(30)
        
        # Send the request
        msg = json.dumps(request) + "\n"
        self.socket.send(msg.encode("utf-8"))
        
        # Small delay to let server process
        time.sleep(0.05)
        
        # Now receive the response
        return self._receive_response_internal()

    def _receive_response(self):
        """Legacy method for compatibility. Use _send_and_receive instead."""
        return self._receive_response_internal()
    
    def _receive_response_internal(self):
        """Receive response from DbSrc agent, handling large responses.
        
        IMPORTANT: Each request/response must be atomic to prevent buffer contamination.
        The socket is persistent, so we must ensure we read exactly one complete response.
        """
        buffer = b''
        chunk_size = 65536
        max_wait_time = 2.0
        
        while True:
            try:
                chunk = self.socket.recv(chunk_size)
                if not chunk:
                    break
                
                buffer += chunk
                
                # Check if we might have a complete message
                if b'\n' in buffer:
                    data = buffer.decode("utf-8", errors='replace').strip()
                    
                    # Try to parse - if there are multiple JSON objects, only take the first one
                    try:
                        # Use JSONDecoder to parse just the first complete object
                        from json import JSONDecoder
                        decoder = JSONDecoder()
                        parsed, idx = decoder.raw_decode(data)
                        
                        # Check if there's extra data after the first JSON object
                        remaining = data[idx:].strip()
                        if remaining:
                            print(f"⚠️ Found extra data after JSON response ({len(remaining)} chars), ignoring it")
                            print(f"⚠️ Extra data preview: {remaining[:200]}")
                        
                        return parsed
                    except json.JSONDecodeError as e:
                        if len(chunk) == chunk_size:
                            print(f"⚠️ Received incomplete JSON, continuing to read... (current size: {len(buffer)} bytes)")
                            continue
                        
                        print(f"⚠️ Incomplete JSON response received (length: {len(data)} bytes)")
                        print(f"⚠️ JSON data: {data}")
                        print(f"⚠️ JSON error: {e}")
                        print(f"⚠️ First 500 chars: {data[:500]}")
                        print(f"⚠️ Last 500 chars: {data[-500:]}")
                        return {
                            "err_code": "99", 
                            "err_msg": f"Incomplete response from DbSrc agent - query result may be too large. Try limiting with FETCH FIRST n ROWS ONLY or WHERE clause.",
                            "raw_length": len(data),
                            "raw_preview": data[:2000] + "..." + data[-500:] if len(data) > 2500 else data
                        }
                
                if len(chunk) < chunk_size:
                    # Wait a bit more to see if there's more data coming
                    self.socket.settimeout(max_wait_time)
                    try:
                        final_chunk = self.socket.recv(chunk_size)
                        if final_chunk:
                            buffer += final_chunk
                            continue
                    except socket.timeout:
                        pass
                    finally:
                        self.socket.settimeout(30)
                    break
                    
            except socket.timeout:
                print("⚠️ Socket timeout while waiting for response")
                break
            except Exception as e:
                print(f"❌ Error receiving response: {e}")
                break
        
        data = buffer.decode("utf-8", errors='replace').strip()
        if not data:
            return {"err_code": "98", "err_msg": "Empty response from DbSrc agent"}
        
        try:
            # Use JSONDecoder to parse just the first complete object
            from json import JSONDecoder
            decoder = JSONDecoder()
            parsed, idx = decoder.raw_decode(data)
            
            # Check if there's extra data after the first JSON object
            remaining = data[idx:].strip()
            if remaining:
                print(f"⚠️ Found extra data in final parse ({len(remaining)} chars), ignoring it")
            
            return parsed
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse response as JSON: {e}")
            print(f"⚠️ Response length: {len(data)} bytes")
            return {
                "err_code": "99", 
                "err_msg": "Invalid or incomplete JSON response from DbSrc agent. The query may be returning too much data.",
                "raw_length": len(data),
                "raw_preview": data[:2000] + "..." + data[-500:] if len(data) > 2500 else data
            }

    def connect_agent(self):
        print(f"🔌 Connecting to DbSrc Agent {self.host}:{self.port} ...")
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.settimeout(30)
        self.socket.connect((self.host, self.port))

        request = {
            "password": base64.b64encode(self.agent_password.encode()).decode(),
            "action": "agent.connect",
        }
        resp = self._send_and_receive(request)
        if resp.get("err_code") != "0":
            raise Exception(f"❌ Agent connection failed: {resp}")
        print("✅ Agent connected successfully.")
        return True

    def authenticate_user(self, username, password):
        """Validate DbSrc user credentials and get token."""
        cmd = f"validate.password.dbsrc.user.{username}.{password}"
        request = {
            "password": base64.b64encode(self.agent_password.encode()).decode(),
            "action": cmd,
        }
        resp = self._send_and_receive(request)

        if resp.get("err_code") != "0" or "token" not in resp:
            raise Exception(f"❌ Authentication failed: {resp}")

        self.token = resp["token"]
        print(f"🔑 Token obtained: {self.token}")
        return self.token

    def validate_user_h2m(self, username):
        """Try to validate H2M user and get token using original approach."""
        print(f"🔑 Attempting H2M user validation for {username}")
        
        
        possible_commands = [
            f"validate.password.dbsrc.user.{username}.**",  
            f"validate.h2m.user.{username}",                
            f"validate.user.{username}",                    
        ]
        
        for cmd in possible_commands:
            try:
                print(f"🔑 Trying validation command: {cmd}")
                request = {
                    "password": base64.b64encode(self.agent_password.encode()).decode(),
                    "action": cmd,
                }
                resp = self._send_and_receive(request)
                print(f"🔑 Validation response for {cmd}: {resp}")
                
                if resp.get("err_code") == "0":
                    if "token" in resp:
                        self.token = resp["token"]
                        print(f"🔑 H2M Token obtained with {cmd}: {self.token}")
                        return self.token
                    else:
                        print(f"✅ Command {cmd} succeeded but no token, trying next...")
                        continue
                        
            except Exception as e:
                print(f"⚠️ Command {cmd} failed: {e}")
                continue
        
        # If no token obtained, maybe H2M doesn't need one
        print("⚠️ No token obtained, will try ACCP connection without token")
        self.token = None
        return "h2m_no_token"

    def show_user_access(self, username):
        """Show user's database access details including available schemas."""
        cmd = f"show.dbsrc.user.db.access.{username}"
        request = {
            "password": base64.b64encode(self.agent_password.encode()).decode(),
            "action": cmd,
        }
        return self._send_and_receive(request)
    
    def list_user_accps(self, username):
        """List all ACCPs accessible to the user.
        Returns list of ACCP dictionaries with id, name, and description.
        Command: show.dbsrc.user.accp.access.{username}
        """
        print(f"📋 Fetching accessible ACCPs for user {username}")
        
        cmd = f"show.dbsrc.user.accp.access.{username}"
        request = {
            "password": base64.b64encode(self.agent_password.encode()).decode(),
            "action": cmd,
        }
        access_data = self._send_and_receive(request)
        
        return self.parse_accessible_accps(access_data)

    def parse_accessible_accps(self, access_data):
        """Parse ACCP list from DbSrc response.
        
        Response format:
        {
            "err_code": "0",
            "data": [
                {"ACCP_ID": "345", "ACCP_NAME": "ACCP_SCAL_LIVE_3236", "SCHEMA_NAME": "SCAL_LIVE", ...},
                ...
            ]
        }
        """
        accps = []
        print(f"🔍 Parsing ACCP access data: {access_data}")
        
        try:
            if access_data.get("err_code") == "0":
                data = access_data.get("data", {})
                print(f"🔍 Raw data field type: {type(data)}")
                
                if isinstance(data, str):
                    try:
                        data = json.loads(data)
                        print(f"🔍 Parsed JSON data: {data}")
                    except json.JSONDecodeError as e:
                        print(f"⚠️ Failed to parse data as JSON: {e}")
                        return []
                
                if isinstance(data, list):
                    for item in data:
                        print(f"🔍 Processing ACCP item: {item}")
                        if isinstance(item, dict):
                            # Log ALL fields to check for ROLE metadata
                            print(f"🔍 Available fields in item: {list(item.keys())}")
                            
                            accp_id = str(item.get("ACCP_ID") or item.get("accp_id") or item.get("ID") or "")
                            accp_name = item.get("ACCP_NAME") or item.get("accp_name") or item.get("NAME") or ""
                            schema_name = item.get("SCHEMA_NAME") or item.get("schema_name") or item.get("DB_NAME") or ""
                            accp_type = item.get("ACCP_TYPE") or item.get("accp_type") or "USER"  # USER or ROLE
                            db_name = item.get("DB_NAME") or item.get("db_name") or ""
                            description = item.get("DESCRIPTION") or item.get("description") or ""
                            
                            # Check for ROLE-specific fields that teacher may have added
                            role_name = item.get("ROLE_NAME") or item.get("role_name") or item.get("ROLE") or ""
                            role_password = item.get("ROLE_PASSWORD") or item.get("role_password") or ""
                            
                            if role_name:
                                print(f"🔐 Found ROLE metadata! ROLE_NAME={role_name}")
                            
                            if not description:
                                if schema_name and accp_name:
                                    description = f"{schema_name} (via {accp_name})"
                                elif schema_name:
                                    description = schema_name
                                elif accp_name:
                                    description = accp_name
                            
                            if accp_id:
                                accps.append({
                                    "accp_id": accp_id,
                                    "accp_name": accp_name,
                                    "accp_type": accp_type,
                                    "schema_name": schema_name,
                                    "role_name": role_name,  # Include ROLE name if available
                                    "description": description
                                })
                                print(f"✅ Found ACCP: ID={accp_id}, Name={accp_name}, Type={accp_type}, Schema={schema_name}, Role={role_name}")
                            else:
                                print(f"⚠️ Skipping item with no ACCP_ID: {item}")
                            
                elif isinstance(data, dict) and ("ACCP_ID" in data or "accp_id" in data):
                    accp_id = str(data.get("ACCP_ID") or data.get("accp_id") or "")
                    accp_name = data.get("ACCP_NAME") or data.get("accp_name") or data.get("NAME") or ""
                    schema_name = data.get("SCHEMA_NAME") or data.get("schema_name") or data.get("DB_NAME") or ""
                    accp_type = data.get("ACCP_TYPE") or data.get("accp_type") or "USER"
                    description = data.get("DESCRIPTION") or data.get("description") or ""
                    
                    if not description:
                        if schema_name and accp_name:
                            description = f"{schema_name} (via {accp_name})"
                        elif schema_name:
                            description = schema_name
                        elif accp_name:
                            description = accp_name
                    
                    if accp_id:
                        accps.append({
                            "accp_id": accp_id,
                            "accp_name": accp_name,
                            "accp_type": accp_type,
                            "schema_name": schema_name,
                            "description": description
                        })
                        print(f"✅ Found ACCP: ID={accp_id}, Name={accp_name}, Schema={schema_name}")
                else:
                    print(f"⚠️ Unexpected data format: {type(data)}")
                        
            else:
                error_msg = access_data.get('err_msg', 'Unknown error')
                print(f"❌ Access data error: {error_msg}")
                raise Exception(f"Failed to get ACCPs: {error_msg}")
                
        except Exception as e:
            print(f"❌ Error parsing ACCPs: {e}")
            raise
        
        if not accps:
            print("⚠️ No ACCPs found in response")
            
        print(f"🔍 Final ACCPs list ({len(accps)} found): {accps}")
        return accps

    def connect_accp(self, schema_id, username, host_ip="127.0.0.1"):
        """Connect to ACCP using token-based or H2M direct connection."""
        
        print(f"🔗 Connecting to ACCP {schema_id} for user {username}")
        
        if self.token and self.token not in ["h2m_no_token", "h2m_user"]:
            cmd = f"connect.accp.{schema_id}.{self.token}.{username}.{host_ip}"
            print(f"🔗 Trying token-based connection: {cmd}")
            request = {
                "password": base64.b64encode(self.agent_password.encode()).decode(),
                "action": cmd,
            }
            try:
                resp = self._send_and_receive(request)
                print(f"🔗 Token connection response: {resp}")
                
                if resp.get("err_code") == "0":
                    print(f"✅ Connected to ACCP {schema_id} with token")
                    # Extract schema name from message like "Connected to schema ACCP_DISCIPLUS_LIVE_U_9393"
                    schema_name = self._extract_schema_name(resp.get("err_msg", ""))
                    return {"connected": True, "schema_name": schema_name}
                    
            except Exception as e:
                print(f"⚠️ Token connection failed: {e}")
        
        print("🔗 Trying H2M direct connection...")
        possible_commands = [
            f"connect.accp.{schema_id}.{username}.{host_ip}",
            f"connect.accp.{schema_id}.{username}",
        ]
        
        last_error = None
        for cmd in possible_commands:
            try:
                print(f"🔗 Trying: {cmd}")
                request = {
                    "password": base64.b64encode(self.agent_password.encode()).decode(),
                    "action": cmd,
                }
                resp = self._send_and_receive(request)
                print(f"🔗 Response: {resp}")
                
                if resp.get("err_code") == "0":
                    print(f"✅ Connected to ACCP {schema_id} with command: {cmd}")
                    schema_name = self._extract_schema_name(resp.get("err_msg", ""))
                    return {"connected": True, "schema_name": schema_name}
                    
                last_error = resp.get("err_msg", "Unknown error")
                
            except Exception as e:
                last_error = str(e)
                continue
        
        raise Exception(f"❌ ACCP connection failed. Error: {last_error}")
    
    def _extract_schema_name(self, message):
        """Extract schema name from connection message like 'Connected to schema ACCP_DISCIPLUS_LIVE_U_9393'"""
        import re
        match = re.search(r'Connected to schema\s+(\S+)', message)
        if match:
            return match.group(1)
        return None

    def show_access(self, username):
        """Query Oracle data dictionary for accessible tables and views after ACCP connection."""
        query = """
            SELECT OWNER as USERNAME, OBJECT_NAME, OBJECT_TYPE 
            FROM ALL_OBJECTS 
            WHERE OBJECT_TYPE IN ('TABLE', 'VIEW', 'INDEX', 'FUNCTION')
            AND OWNER NOT IN ('SYS', 'SYSTEM', 'OUTLN', 'DBSNMP', 'APPQOSSYS', 'WMSYS', 'EXFSYS', 'CTXSYS', 'XDB', 'ANONYMOUS', 'ORDSYS', 'ORDDATA', 'MDSYS', 'LBACSYS', 'DVSYS', 'DVF', 'GSMADMIN_INTERNAL', 'ORDPLUGINS', 'OLAPSYS', 'FLOWS_FILES', 'ORACLE_OCM', 'APEX_PUBLIC_USER', 'SI_INFORMTN_SCHEMA', 'SPATIAL_CSW_ADMIN_USR', 'SPATIAL_WFS_ADMIN_USR', 'SYSMAN', 'MGMT_VIEW', 'APEX_040200', 'OWBSYS', 'OWBSYS_AUDIT', 'SCOTT', 'DEMO')
            ORDER BY OWNER, OBJECT_NAME
            FETCH FIRST 1000 ROWS ONLY
        """
        
        print(f"📋 Requesting accessible objects via SQL query")
        
        try:
            response = self.run_sql(query)
            print(f"📋 Access query response err_code: {response.get('err_code')}")
            
            if response.get('err_code') == '0':
                return response
            else:
                print(f"⚠️ SQL query failed, trying legacy command")
                cmd = f"show.dbsrc.user.accp.objects.access.{username}"
                request = {
                    "password": base64.b64encode(self.agent_password.encode()).decode(),
                    "action": cmd,
                }
                response = self._send_and_receive(request)
                print(f"📋 Legacy access response: {response}")
                return response
                
        except Exception as e:
            print(f"❌ Error getting access objects: {e}")
            return {
                "err_code": "1",
                "err_msg": f"Failed to get accessible objects: {e}",
                "data": [],
                "columns": []
            }

    def set_role(self, role_name, role_password):
        """Execute ALTER SESSION SET ROLE command for ROLE-type ACCP connections.
        
        Teacher's requirement: Use ALTER SESSION SET ROLE instead of just SET ROLE
        This is executed after connecting to USER schema to activate ROLE privileges.
        
        Args:
            role_name: The role name (e.g., 'ACCP_DISCIPLUS_LIVE_R_9921')
            role_password: The role password received via email (OTP-style)
        
        Returns:
            Response from ALTER SESSION SET ROLE command
        """
        set_role_sql = f'ALTER SESSION SET ROLE {role_name} IDENTIFIED BY "{role_password}"'
        print(f"🔐 Setting ROLE: {role_name}")
        print(f"▶️ SQL: {set_role_sql}")
        return self.run_sql(set_role_sql)

    def run_sql(self, query):
        """Execute SQL query through DbSrc agent.
        
        CRITICAL: Uses atomic send+receive to prevent buffer contamination.
        """
        cmd = f"sql.[{query}]"
        request = {
            "password": base64.b64encode(self.agent_password.encode()).decode(),
            "action": cmd,
        }
        print(f"▶️ Running SQL: {query}")
        resp = self._send_and_receive(request)

        if resp.get("err_code") == "0":
            data_field = resp.get("data")
            if isinstance(data_field, str):
                try:
                    parsed_data = json.loads(data_field)
                    resp["data"] = parsed_data
                    if isinstance(parsed_data, list) and len(parsed_data) > 0 and isinstance(parsed_data[0], dict):
                        if "columns" not in resp:
                            resp["columns"] = list(parsed_data[0].keys())
                except json.JSONDecodeError:
                    try:
                        unescaped = data_field.encode('utf-8').decode('unicode_escape')
                        parsed_data = json.loads(unescaped)
                        resp["data"] = parsed_data
                        if isinstance(parsed_data, list) and len(parsed_data) > 0 and isinstance(parsed_data[0], dict):
                            if "columns" not in resp:
                                resp["columns"] = list(parsed_data[0].keys())
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        print(f"⚠️ Warning: Could not parse data field as JSON, keeping as string")
                        pass
            if not isinstance(resp.get("data"), list):
                resp["data"] = []
                resp["err_code"] = "1"
                resp["err_msg"] = "Invalid data format received from DbSrc agent"

        print("\n=== SQL RESPONSE ===")
        print(json.dumps(resp, indent=4))
        return resp

    def disconnect(self):
        """Gracefully disconnect from ACCP and Agent."""
        if not self.socket:
            return
        for action in ["disconnect.accp", "agent.disconnect"]:
            request = {
                "password": base64.b64encode(self.agent_password.encode()).decode(),
                "action": action,
            }
            try:
                _ = self._send_and_receive(request)
            except Exception:
                pass
        
        # Safe socket cleanup
        if self.socket is not None:
            try:
                self.socket.close()
            except Exception:
                pass  # Socket already closed or invalid
            self.socket = None
        print("👋 Disconnected from DbSrc Agent.")


def main():
    # ====== ENTER YOUR CREDENTIALS HERE ======
    username = "ivan"
    user_password = "Rc3e4745c$4"
    schema_id = "345"
    host_ip = "127.0.0.1"

    connector = DbSrcConnector()

    try:
        # 1. Connect & authenticate
        connector.connect_agent()
        connector.authenticate_user(username, user_password)
        connector.connect_accp(schema_id, username, host_ip)

        # 2. (Optional) Show accessible objects
        access_data = connector.show_access(username)
        print("\n=== ACCESSIBLE OBJECTS ===")
        print(json.dumps(access_data, indent=4))

        # 3. Run a test query
        query = """
        SELECT SUM(total) AS total_sum, "OPERATION NAME"
        FROM SCAL_LIVE.ALL_OPER_STATS
        WHERE "DOCTOR ID" = 702
        AND year = 2023
        GROUP BY "OPERATION NAME"
        """
        connector.run_sql(query)

    except Exception as e:
        print(f"\n❌ ERROR: {e}")
    finally:
        connector.disconnect()


if __name__ == "__main__":
    main()
