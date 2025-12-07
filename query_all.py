import base64
import json
import socket
import os
from dotenv import load_dotenv, find_dotenv

# Load .env (search parent dirs) so repo root .env is found when running from subfolders
load_dotenv(find_dotenv())


class DbSrcConnector:
    """
    Minimal DbSrc client for connecting to the Agent,
    authenticating, showing ACCP objects, and running SQL queries.
    """

    def __init__(self, host="www.compute-mertjiandata.com", port=9000, agent_password=None):
        self.host = host
        self.port = port
        self.socket = None
        self.agent_password = agent_password or os.environ.get("DBSRC_AGENT_PASSWORD", "dbsrc$admin2024!")
        self.token = None

    # ====== low-level helper methods ======
    def _send_request(self, request):
        msg = json.dumps(request) + "\n"
        self.socket.send(msg.encode("utf-8"))

    def _receive_response(self):
        """Receive response from DbSrc agent, handling large responses."""
        buffer = b''
        chunk_size = 65536  # 64KB chunks
        max_wait_time = 2.0  # Maximum time to wait for more data after getting incomplete JSON
        
        while True:
            try:
                chunk = self.socket.recv(chunk_size)
                if not chunk:
                    break
                
                buffer += chunk
                
                # Check if we might have a complete message
                if b'\n' in buffer:
                    # Try to parse the JSON
                    data = buffer.decode("utf-8", errors='replace').strip()
                    try:
                        parsed = json.loads(data)
                        # Successfully parsed - we have complete JSON
                        return parsed
                    except json.JSONDecodeError as e:
                        # JSON is malformed - could be truncated
                        # Continue reading if the chunk was full size (more data might be coming)
                        if len(chunk) == chunk_size:
                            print(f"⚠️ Received incomplete JSON, continuing to read... (current size: {len(buffer)} bytes)")
                            continue
                        
                        # Last chunk was smaller - this is likely all we'll get
                        print(f"⚠️ Incomplete JSON response received (length: {len(data)} bytes)")
                        print(f"⚠️ JSON error: {e}")
                        print(f"⚠️ First 500 chars: {data[:500]}")
                        print(f"⚠️ Last 500 chars: {data[-500:]}")
                        return {
                            "err_code": "99", 
                            "err_msg": f"Incomplete response from DbSrc agent - query result may be too large. Try limiting with FETCH FIRST n ROWS ONLY or WHERE clause.",
                            "raw_length": len(data),
                            "raw_preview": data[:2000] + "..." + data[-500:] if len(data) > 2500 else data
                        }
                
                # If last chunk was smaller than buffer, we're likely at the end
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
        
        # If we get here, we have all the data but no newline delimiter or invalid JSON
        data = buffer.decode("utf-8", errors='replace').strip()
        if not data:
            return {"err_code": "98", "err_msg": "Empty response from DbSrc agent"}
        
        try:
            return json.loads(data)
        except json.JSONDecodeError as e:
            print(f"❌ Failed to parse response as JSON: {e}")
            print(f"⚠️ Response length: {len(data)} bytes")
            return {
                "err_code": "99", 
                "err_msg": "Invalid or incomplete JSON response from DbSrc agent. The query may be returning too much data.",
                "raw_length": len(data),
                "raw_preview": data[:2000] + "..." + data[-500:] if len(data) > 2500 else data
            }

    # ====== core commands ======
    def connect_agent(self):
        print(f"🔌 Connecting to DbSrc Agent {self.host}:{self.port} ...")
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.settimeout(30)  # 30 second timeout for responses
        self.socket.connect((self.host, self.port))

        request = {
            "password": base64.b64encode(self.agent_password.encode()).decode(),
            "action": "agent.connect",
        }
        self._send_request(request)
        resp = self._receive_response()
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
        self._send_request(request)
        resp = self._receive_response()

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
                self._send_request(request)
                resp = self._receive_response()
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
        self._send_request(request)
        return self._receive_response()
    
    def list_user_accps(self, username):
        """List all ACCPs accessible to the user.
        
        This method should be called after authentication but before ACCP connection.
        Returns a list of ACCP dictionaries with id, name, and description.
        
        Uses the command: show.dbsrc.user.accp.access.{username}
        This returns the actual ACCP profiles the user has access to.
        """
        print(f"📋 Fetching accessible ACCPs for user {username}")
        
        # Use the correct command to get ACCP access (not db.access)
        cmd = f"show.dbsrc.user.accp.access.{username}"
        request = {
            "password": base64.b64encode(self.agent_password.encode()).decode(),
            "action": cmd,
        }
        self._send_request(request)
        access_data = self._receive_response()
        
        # Parse and return ACCPs
        return self.parse_accessible_accps(access_data)

    def parse_accessible_accps(self, access_data):
        """Parse accessible ACCPs from the access response.
        
        Expected format from DbSrc (show.dbsrc.user.accp.access.{username}):
        {
            "err_code": "0",
            "data": [
                {
                    "ACCP_ID": "345", 
                    "ACCP_NAME": "ACCP_SCAL_LIVE_6666",
                    "SCHEMA_NAME": "SCAL_LIVE",
                    ...
                },
                {
                    "ACCP_ID": "382",
                    "ACCP_NAME": "ACCP_DISCIPLUS_LIVE_6190", 
                    "SCHEMA_NAME": "DISCIPLUS_LIVE",
                    ...
                },
                ...
            ]
        }
        
        Note: ACCP_ID is what we use to connect (e.g., 345, 382)
        ACCP_NAME contains the database user name pattern
        SCHEMA_NAME is the actual schema the ACCP grants access to
        """
        accps = []
        print(f"🔍 Parsing ACCP access data: {access_data}")
        
        try:
            if access_data.get("err_code") == "0":
                data = access_data.get("data", {})
                print(f"🔍 Raw data field type: {type(data)}")
                
                # If data is a JSON string, parse it
                if isinstance(data, str):
                    try:
                        data = json.loads(data)
                        print(f"🔍 Parsed JSON data: {data}")
                    except json.JSONDecodeError as e:
                        print(f"⚠️ Failed to parse data as JSON: {e}")
                        return []
                
                # Process list of ACCPs
                if isinstance(data, list):
                    for item in data:
                        print(f"🔍 Processing ACCP item: {item}")
                        if isinstance(item, dict):
                            # Extract ACCP information - prioritize actual ACCP_ID field
                            accp_id = str(item.get("ACCP_ID") or item.get("accp_id") or item.get("ID") or "")
                            accp_name = item.get("ACCP_NAME") or item.get("accp_name") or item.get("NAME") or ""
                            schema_name = item.get("SCHEMA_NAME") or item.get("schema_name") or item.get("DB_NAME") or ""
                            db_name = item.get("DB_NAME") or item.get("db_name") or ""
                            description = item.get("DESCRIPTION") or item.get("description") or ""
                            
                            # Build a descriptive name
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
                                    "schema_name": schema_name,
                                    "description": description
                                })
                                print(f"✅ Found ACCP: ID={accp_id}, Name={accp_name}, Schema={schema_name}")
                            else:
                                print(f"⚠️ Skipping item with no ACCP_ID: {item}")
                            
                # Process single ACCP dict
                elif isinstance(data, dict) and ("ACCP_ID" in data or "accp_id" in data):
                    accp_id = str(data.get("ACCP_ID") or data.get("accp_id") or "")
                    accp_name = data.get("ACCP_NAME") or data.get("accp_name") or data.get("NAME") or ""
                    schema_name = data.get("SCHEMA_NAME") or data.get("schema_name") or data.get("DB_NAME") or ""
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
        """Connect to ACCP using token if available, or try H2M direct connection."""
        
        print(f"🔗 Connecting to ACCP {schema_id} for user {username}")
        
        # Try with token first if we have one
        if self.token and self.token not in ["h2m_no_token", "h2m_user"]:
            cmd = f"connect.accp.{schema_id}.{self.token}.{username}.{host_ip}"
            print(f"🔗 Trying token-based connection: {cmd}")
            request = {
                "password": base64.b64encode(self.agent_password.encode()).decode(),
                "action": cmd,
            }
            try:
                self._send_request(request)
                resp = self._receive_response()
                print(f"🔗 Token connection response: {resp}")
                
                if resp.get("err_code") == "0":
                    print(f"✅ Connected to ACCP {schema_id} with token")
                    return True
                    
            except Exception as e:
                print(f"⚠️ Token connection failed: {e}")
        
        # If token approach failed, try H2M direct connection
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
                self._send_request(request)
                resp = self._receive_response()
                print(f"🔗 Response: {resp}")
                
                if resp.get("err_code") == "0":
                    print(f"✅ Connected to ACCP {schema_id} with command: {cmd}")
                    return True
                    
                last_error = resp.get("err_msg", "Unknown error")
                
            except Exception as e:
                last_error = str(e)
                continue
        
        raise Exception(f"❌ ACCP connection failed. Error: {last_error}")

    def show_access(self, username):
        """Show accessible objects for the user after ACCP connection.
        
        After connecting to an ACCP, we query the database to get accessible tables.
        The ACCP connection automatically limits what we can see.
        """
        print(f"📋 Requesting accessible objects for user {username}")
        
        # First try the DbSrc command
        cmd = f"show.dbsrc.user.accp.objects.access.{username}"
        request = {
            "password": base64.b64encode(self.agent_password.encode()).decode(),
            "action": cmd,
        }
        
        try:
            self._send_request(request)
            response = self._receive_response()
            print(f"📋 DbSrc command response: {response}")
            
            # If the command works, return it
            if response.get('err_code') == '0':
                return response
                
            # If it fails, fall back to SQL query
            print(f"⚠️ DbSrc command failed, using SQL query instead")
            
        except Exception as e:
            print(f"⚠️ DbSrc command error: {e}, falling back to SQL query")
        
        # Fall back to SQL query - get objects from USER_TABLES and ALL_TABLES
        # The ACCP connection restricts what we can see
        query = """
            SELECT 
                OWNER as USERNAME, 
                TABLE_NAME as OBJECT_NAME, 
                'TABLE' as OBJECT_TYPE
            FROM ALL_TABLES
            WHERE OWNER NOT IN ('SYS', 'SYSTEM', 'OUTLN', 'DBSNMP', 'XDB', 'CTXSYS', 'MDSYS')
            UNION ALL
            SELECT 
                OWNER as USERNAME, 
                VIEW_NAME as OBJECT_NAME, 
                'VIEW' as OBJECT_TYPE
            FROM ALL_VIEWS
            WHERE OWNER NOT IN ('SYS', 'SYSTEM', 'OUTLN', 'DBSNMP', 'XDB', 'CTXSYS', 'MDSYS')
            ORDER BY USERNAME, OBJECT_NAME
            FETCH FIRST 500 ROWS ONLY
        """
        
        print(f"📋 Querying database for accessible objects")
        
        try:
            response = self.run_sql(query)
            print(f"📋 SQL query response err_code: {response.get('err_code')}")
            return response
        except Exception as e:
            print(f"❌ Error getting access objects: {e}")
            return {
                "err_code": "1",
                "err_msg": f"Failed to get accessible objects: {e}",
                "data": [],
                "columns": []
            }

    def run_sql(self, query):
        """
        Execute an SQL query through DbSrc.
        Example: SELECT * FROM SCAL_LIVE.ALL_OPER_STATS FETCH FIRST 5 ROWS ONLY
        """
        cmd = f"sql.[{query}]"
        request = {
            "password": base64.b64encode(self.agent_password.encode()).decode(),
            "action": cmd,
        }
        print(f"▶️ Running SQL: {query}")
        self._send_request(request)
        resp = self._receive_response()

        # Enhanced JSON parsing for nested data structures
        if resp.get("err_code") == "0":
            data_field = resp.get("data")
            if isinstance(data_field, str):
                try:
                    # First attempt - direct parse
                    parsed_data = json.loads(data_field)
                    resp["data"] = parsed_data
                    # Add columns if not present
                    if isinstance(parsed_data, list) and len(parsed_data) > 0 and isinstance(parsed_data[0], dict):
                        if "columns" not in resp:
                            resp["columns"] = list(parsed_data[0].keys())
                except json.JSONDecodeError:
                    # Second attempt - it might be double-escaped JSON
                    try:
                        # Unescape and try again
                        unescaped = data_field.encode('utf-8').decode('unicode_escape')
                        parsed_data = json.loads(unescaped)
                        resp["data"] = parsed_data
                        if isinstance(parsed_data, list) and len(parsed_data) > 0 and isinstance(parsed_data[0], dict):
                            if "columns" not in resp:
                                resp["columns"] = list(parsed_data[0].keys())
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        # Keep original string if all parsing fails - this will cause frontend to show error
                        print(f"⚠️ Warning: Could not parse data field as JSON, keeping as string")
                        pass
            # Ensure data is always a list if err_code is 0
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
                self._send_request(request)
                _ = self._receive_response()
            except Exception:
                pass
        self.socket.close()
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
