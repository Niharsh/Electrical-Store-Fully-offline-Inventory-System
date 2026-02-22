import os, sys
from django.conf import settings
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
os.environ['DJANGO_SETTINGS_MODULE']='config.settings'
import django
django.setup()
from rest_framework.test import APIRequestFactory
from importlib import import_module
views = import_module('authentication.views')
AuthViewSet = views.AuthViewSet
factory = APIRequestFactory()
# Use a payload that will likely trigger login path
req = factory.post('/api/auth/login/', {'email':'owner@medicalshop.com','password':'wrong'}, format='json')
view = AuthViewSet.as_view({'post':'login'})
resp = view(req)
print('RESPONSE STATUS:', resp.status_code)
print('RESPONSE DATA:', getattr(resp, 'data', None))
