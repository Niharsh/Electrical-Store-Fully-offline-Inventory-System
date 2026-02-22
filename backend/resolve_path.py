import os, sys
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
os.environ['DJANGO_SETTINGS_MODULE']='config.settings'
import django
django.setup()
from django.urls import resolve
path = '/api/auth/login/'
res = resolve(path)
print('RESOLVED_VIEW:', res.func)
print('MODULE:', getattr(res.func, '__module__', None))
print('NAME:', getattr(res.func, '__name__', None))
# If it's a viewset action, it will have cls
if hasattr(res.func, 'cls'):
    print('VIEWSET_CLASS:', res.func.cls)
if hasattr(res.func, 'actions'):
    print('ACTIONS:', res.func.actions)
print('KWARGS:', res.kwargs)
print('URL_NAME:', res.url_name)
