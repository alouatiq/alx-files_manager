# Files Manager

## Description

Files Manager is a back-end service built with Node.js, Express, MongoDB, Redis, and Bull. It allows users to register, authenticate via tokens, upload and manage files (including folders and images), and retrieve file contents. The system supports background tasks like image thumbnail generation and sending welcome emails.

## Features

* User registration with SHA1 password hashing
* Token-based user authentication using Redis
* Upload folders, files, and images
* Store uploaded files in local storage
* View, list, publish, and unpublish files
* Retrieve raw file content or image thumbnails
* Background job processing using Bull queues:

  * Generate image thumbnails in sizes: 500, 250, 100
  * Simulate welcome email message
* RESTful API design

## Technologies

* Node.js
* Express.js
* MongoDB
* Redis
* Bull (queues)
* image-thumbnail
* mime-types
* Mocha, Chai (testing)

## Requirements

* Node.js 12.x+
* MongoDB running locally or via URI
* Redis running locally

## Environment Variables

You can define the following env variables:

```bash
PORT=5000
DB_HOST=localhost
DB_PORT=27017
DB_DATABASE=files_manager
FOLDER_PATH=/tmp/files_manager
```

## Installation

```bash
git clone https://github.com/your-username/alx-files_manager.git
cd alx-files_manager
npm install
```

## Running the Project

### Start API server:

```bash
npm run start-server
```

### Start background workers:

```bash
npm run start-worker
```

## Testing

Run all tests using:

```bash
npm test
```

## API Endpoints

### System

* `GET /status` – Redis and DB status
* `GET /stats` – Number of users and files

### Users

* `POST /users` – Register
* `GET /connect` – Login via Basic Auth
* `GET /disconnect` – Logout
* `GET /users/me` – Authenticated user info

### Files

* `POST /files` – Upload file/folder/image
* `GET /files/:id` – File metadata
* `GET /files` – List user files (pagination supported)
* `PUT /files/:id/publish` – Make file public
* `PUT /files/:id/unpublish` – Make file private
* `GET /files/:id/data` – File content or image thumbnail

## Author

Hassan AL OUATIQ

## License

This project is for educational use under the ALX SE program.
