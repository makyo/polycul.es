FROM python:latest

# Set CWD & copy files
WORKDIR /usr/src/app
COPY . .

# Install system dependencies
RUN apt-get update
RUN apt-get install -y virtualenv graphviz

# Build & expose ports
RUN make
EXPOSE 5000

# Run polycul.es
CMD [ "make", "gunicorn"]
