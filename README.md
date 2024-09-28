# GLPi and Zabbix Integration

This repository contains scripts and configuration files that enable integration between [Zabbix](https://www.zabbix.com/) and [GLPi](https://glpi-project.org/). The integration leverages Zabbix as the monitoring tool and GLPi as the IT asset management and issue ticketing system. The provided script facilitates the automation of creating and updating problem tickets in GLPi whenever Zabbix triggers a event.

## Features
- **Automatic Ticket Creation**: When an event is triggered in Zabbix, a new problem ticket is created in GLPi.
- **Ticket Updates**: Events such as problem resolution or status updates are automatically reflected in the corresponding GLPi ticket.
- **App-Token and User-Token Authentication**: Uses both the `App-Token` and `User-Token` for secure API communication with GLPi.

---

## Project Structure
- `docker-compose.yml`: A configuration file to run your GLPi test environment via Docker.
- `gpli_zabbix_media_script.js`: The JavaScript file used to automate ticket creation and updates in GLPi based on Zabbix events (Webhook).

---

## Requirements
- **GLPi**: Ensure you have a running GLPi instance with REST API enabled.
- **Zabbix**: A functioning Zabbix server to monitor your infrastructure.
- **Docker**: Used for containerizing and managing Zabbix and GLPi instances.

---

## Setup and Usage

### Step 1: Docker Setup

1. Clone this repository:
   ```bash
   git clone https://github.com/FrancoTadeu/glpi-zabbix-integration.git
   cd glpi-zabbix-integration
   ```


2. Run the following command to start the services:

    ```bash
    docker-compose up -d
    ```
    ###### This command will spin up the Zabbix and GLPi instances.

3. Once both services are up, access the ***webpages*** through:

    |Service|Access Link|
    |----|-----------|
    |Zabbix | http://localhost:8080|
    |GLPi | http://localhost:30080|


### Step 2: Zabbix Media Script

Copy the contents of the gpli_zabbix_media_script.js to your standard GLPI media.

Please use this link for futher instruction on GLPI API config - [`Zabbix GLPI GIT`](https://git.zabbix.com/projects/ZBX/repos/zabbix/browse/templates/media/glpi)

**Set the following parameters in Zabbix:**

`glpi_url`  The URL of your GLPi instance.
`glpi_token`  The user token for authenticating with GLPi.
`glpi_app_token`  The application token for authenticating API requests.

---
### Script Overview
`gpli_zabbix_media_script.js`

This script is responsible for interacting with the GLPi API based on Zabbix events. It was forked from the original script provided by Zabbix with the addition of `app_token` usage. Key functionalities include:

**Authentication:** Uses both `user_token` and `app_token` to securely communicate with the GLPi API.

**Ticket Creation:** When a new problem is detected in Zabbix, the script creates a ticket in GLPi with relevant details like urgency and description.

**Ticket Update:** When an issue is resolved or its status changes in Zabbix, the script updates the corresponding ticket in GLPi.

**Code Snippet (for authentication):**

```javascript
request.addHeader('Authorization: user_token ' + token);
request.addHeader('App-Token: ' + app_token);
```