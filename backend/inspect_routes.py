import os, sys
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings'
import django
django.setup()
from importlib import import_module
u = import_module('authentication.urls')
print('AUTH_URLS_MODULE->', u)
for pattern in u.router.urls:
    try:
        print('PATTERN->', getattr(pattern, 'pattern', pattern), 'name=', getattr(pattern,'name',None))
        callback = pattern.callback
        print('  callback module:', callback.__module__, 'name:', callback.__name__)
    except Exception as e:
        print('ERR', e)
