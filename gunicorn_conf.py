# Gunicorn config variables, based on https://hub.docker.com/r/tiangolo/uwsgi-nginx-flask/
loglevel = "info"
errorlog = "-"  # stderr
accesslog = "-"  # stdout
worker_tmp_dir = "/dev/shm"
graceful_timeout = 120
timeout = 120
keepalive = 5
threads = 3
