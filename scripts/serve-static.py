import sys, os
os.chdir(os.path.expanduser('~/projects/Shoebox V2/public'))
os.execvp(sys.executable, [sys.executable, '-m', 'http.server', '8080'])
