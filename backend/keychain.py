"""Read credentials through stdin; use macOS Security APIs without shell arguments."""
import ctypes as c
import json
import sys

s = c.CDLL('/System/Library/Frameworks/Security.framework/Security')
f = c.CDLL('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation')
f.CFRelease.argtypes = [c.c_void_p]
s.SecKeychainFindGenericPassword.argtypes = [c.c_void_p,c.c_uint32,c.c_char_p,c.c_uint32,c.c_char_p,c.POINTER(c.c_uint32),c.POINTER(c.c_void_p),c.POINTER(c.c_void_p)]
s.SecKeychainAddGenericPassword.argtypes = [c.c_void_p,c.c_uint32,c.c_char_p,c.c_uint32,c.c_char_p,c.c_uint32,c.c_char_p,c.POINTER(c.c_void_p)]
s.SecKeychainItemModifyAttributesAndData.argtypes = [c.c_void_p,c.c_void_p,c.c_uint32,c.c_char_p]
s.SecKeychainItemDelete.argtypes = [c.c_void_p]
s.SecKeychainItemFreeContent.argtypes = [c.c_void_p,c.c_void_p]
request = json.load(sys.stdin)
service = request['service'].encode()
account = b'workshop-session'
size, data, item = c.c_uint32(), c.c_void_p(), c.c_void_p()
status = s.SecKeychainFindGenericPassword(None,len(service),service,len(account),account,c.byref(size),c.byref(data),c.byref(item))
if status not in (0,-25300):
    sys.exit(1)
try:
    action = request['action']
    if action == 'read':
        print(c.string_at(data,size.value).decode() if status == 0 else 'null')
    elif action == 'delete':
        if status == 0 and s.SecKeychainItemDelete(item) != 0:
            sys.exit(1)
        print('null')
    elif action == 'write':
        value = json.dumps(request['value']).encode()
        result = s.SecKeychainItemModifyAttributesAndData(item,None,len(value),value) if status == 0 else s.SecKeychainAddGenericPassword(None,len(service),service,len(account),account,len(value),value,None)
        if result != 0:
            sys.exit(1)
        print('null')
    else:
        sys.exit(1)
finally:
    if data.value:
        s.SecKeychainItemFreeContent(None,data)
    if item.value:
        f.CFRelease(item)
