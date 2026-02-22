import importlib.util

spec = importlib.util.find_spec('authentication.serializers')
print('SPEC:', spec)
if spec:
    print('ORIGIN:', spec.origin)

pkg_spec = importlib.util.find_spec('authentication')
print('PKG_SPEC:', pkg_spec)
if pkg_spec and pkg_spec.submodule_search_locations:
    print('PKG_PATHS:', list(pkg_spec.submodule_search_locations))
else:
    print('PKG_PATHS: None')
