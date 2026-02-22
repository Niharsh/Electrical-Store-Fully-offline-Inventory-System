"""Remove all __pycache__ directories and .pyc files under the backend folder."""
import os, shutil
root = os.path.abspath(os.path.dirname(__file__))
removed = []
for dirpath, dirnames, filenames in os.walk(root):
    # remove __pycache__ dirs
    if '__pycache__' in dirnames:
        p = os.path.join(dirpath, '__pycache__')
        try:
            shutil.rmtree(p)
            removed.append(p)
        except Exception as e:
            print('ERR_REMOVE_DIR', p, e)
    for fn in filenames:
        if fn.endswith('.pyc') or fn.endswith('.pyo'):
            fp = os.path.join(dirpath, fn)
            try:
                os.remove(fp)
                removed.append(fp)
            except Exception as e:
                print('ERR_REMOVE_FILE', fp, e)
print('REMOVED_COUNT', len(removed))
for p in removed[:200]:
    print(p)