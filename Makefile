venv/bin/python:
	virtualenv venv
	venv/bin/pip install -r requirements.txt

.PHONY: run
run: venv/bin/python
	venv/bin/python polycules.py

.PHONY: test
test: venv/bin/python
	venv/bin/flake8 --config=.flake8
	venv/bin/nosetests --with-coverage --cover-erase --verbosity=2 --cover-package=polycules,model,migrations.hashify

.PHONY: gunicorn
gunicorn: venv/bin/python
	venv/bin/pip install gunicorn
	venv/bin/gunicorn --conf gunicorn_conf.py --bind 0.0.0.0:5000 polycules:app
