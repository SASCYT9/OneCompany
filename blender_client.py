import socket
import json
import sys

def run_in_blender(code):
    cmd = {
        "type": "execute_code",
        "params": {
            "code": code
        }
    }
    
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(5.0)  # 5 second timeout
        s.connect(('127.0.0.1', 9876))
        s.sendall(json.dumps(cmd).encode('utf-8'))
        
        try:
            response = s.recv(8192).decode('utf-8')
        except socket.timeout:
            return json.dumps({"status": "timeout_or_no_response"})
            
        s.close()
        return response
    except Exception as e:
        return json.dumps({"status": "error", "message": str(e)})

if __name__ == '__main__':
    if len(sys.argv) > 1:
        # direct execution
        code = sys.argv[1]
    else:
        code = sys.stdin.read()
    print(run_in_blender(code))
