import os, sys
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
os.environ['DJANGO_SETTINGS_MODULE']='config.settings'
import django
django.setup()
from rest_framework.test import APIRequestFactory
from rest_framework.request import Request as DRFRequest
from importlib import import_module
import json
views = import_module('authentication.views')
AuthViewSet = views.AuthViewSet
factory = APIRequestFactory()
raw_req = factory.post('/api/auth/login/', data=json.dumps({'email':'owner@medicalshop.com','password':'wrong'}), content_type='application/json')
req = DRFRequest(raw_req)
viewset = AuthViewSet()
# Call method directly
resp = viewset.login(req)
print('DIRECT_CALL_STATUS:', getattr(resp,'status_code', None))
print('DIRECT_CALL_DATA:', getattr(resp,'data', None))
