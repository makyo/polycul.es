# polycul.es

[![Build Status](https://travis-ci.org/makyo/polycul.es.svg?branch=master)](https://travis-ci.org/makyo/polycul.es)
[![Coverage Status](https://coveralls.io/repos/github/makyo/polycul.es/badge.svg?branch=master)](https://coveralls.io/github/makyo/polycul.es?branch=master)
[![polycul.es](https://img.shields.io/website-up-down-green-red/https/polycul.es.svg)](https://polycul.es)

Graphing polyamorous relationships with force directed layouts.

## Development

You will need to install Python, virtualenv, and GraphViz using whatever package manager your operating system uses.  Then you can setup, run and test the application as follows:

1. Create a new virtualenv environment by running `make`
2. Run the application by running `make run` and opening http://localhost:5000/ in a browser
3. Run the tests by running `make test`

Alternatively, you can use Docker:

1. Build and run the image by using `docker-compose up --detach`
2. Alternatively, you can use development mode by using `docker-compose -f docker-compose.yml -f docker-compose.dev.yml up`


## License
This project is licensed under the [MIT License](LICENSE).
