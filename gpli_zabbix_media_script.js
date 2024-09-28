var GLPi = {
    params: {},

    setParams: function (params) {
        if (typeof params !== 'object') {
            return;
        }
        GLPi.params = params;
    },

    setProxy: function (HTTPProxy) {
        GLPi.HTTPProxy = HTTPProxy;
    },

    urlCheckFormat: function (url) {
        if (typeof url === 'string' && !url.endsWith('/')) {
            url += '/';
        }

        if (url.indexOf('http://') === -1 && url.indexOf('https://') === -1) {
            url = 'https://' + url;
        }

        return url;
    },

    // Now includes app_token in addition to user_token
    getAuthToken: function (url, token, app_token) {
        var response,
            request = new HttpRequest();

        request.addHeader('Content-Type: application/json');
        request.addHeader('Authorization: user_token ' + token);
        request.addHeader('App-Token: ' + app_token); // Added App-Token header

        response = request.get(url + "apirest.php/initSession");

        if (response !== null) {
            try {
                response = JSON.parse(response);
            }
            catch (error) {
                Zabbix.log(4, '[ GLPi Webhook ] Failed to receive authentication token from GLPi.');
                response = null;
            }
        }

        if (Array.isArray(response)) {
            if (response[1]) {
                throw 'Error received from GLPi: ' + response[1];
            } else {
                throw 'Failed to receive authentication token from GLPi.';
            }
        }

        if (typeof response !== 'object' || !response.session_token) {
            throw 'Failed to process response received from getting GLPi authentication token. Check debug log for more information.';
        }

        return response.session_token;
    },

    getProblemUrl: function (zabbix_url, triggerid, eventid, event_source) {
        var problem_url = zabbix_url;

        if (event_source === '0') {
            problem_url += 'tr_events.php?triggerid=' + triggerid + '&eventid=' + eventid;
        }

        return problem_url;
    },

    request: function (method, url, data) {
        if (typeof GLPi.params !== 'object' || typeof GLPi.params.authToken === 'undefined' || GLPi.params.authToken === '') {
            throw 'Required GLPi param authToken is not set.';
        }

        var response,
            request = new HttpRequest();

        request.addHeader('Content-Type: application/json');
        request.addHeader('Session-Token:' + GLPi.params.authToken);
        request.addHeader('App-Token: ' + GLPi.params.app_token); // Added App-Token header

        if (typeof GLPi.HTTPProxy !== 'undefined' && GLPi.HTTPProxy !== '') {
            request.setProxy(GLPi.HTTPProxy);
        }

        if (typeof data !== 'undefined') {
            data = JSON.stringify(data);
        }

        Zabbix.log(4, '[ GLPi Webhook ] Sending request: ' + url + ((typeof data === 'string')
            ? ('\n' + data)
            : ''));

        switch (method) {
            case 'post':
                response = request.post(url, data);
                break;

            case 'put':
                response = request.put(url, data);
                break;

            default:
                throw 'Unsupported HTTP request method: ' + method;
        }

        Zabbix.log(4, '[ GLPi Webhook ] Received response with status code ' +
            request.getStatus() + '\n' + response);

        if (response !== null) {
            try {
                response = JSON.parse(response);
            }
            catch (error) {
                Zabbix.log(4, '[ GLPi Webhook ] Failed to parse response received from GLPi');
                response = null;
            }
        }

        if (typeof response !== 'object' || typeof response === 'undefined' || response === null) {
            throw 'Failed to process response received from GLPi. Check debug log for more information.';
        }

        if (request.getStatus() < 200 || request.getStatus() >= 300) {
            var message = 'Request failed with status code ' + request.getStatus();

            if (response.message) {
                message += ': ' + response.message;
            }

            throw message + ' Check debug log for more information.';
        }

        return response;
    }
};

try {
    var params = JSON.parse(value),
        glpi = {},
        url = '',
        data = {},
        comment_data,
        result = { tags: {} },
        required_params = [
            'alert_subject', 'alert_message', 'event_source', 'event_value',
            'event_update_status', 'event_recovery_value',
            'event_id', 'trigger_id', 'zabbix_url',
            'glpi_token', 'glpi_app_token', 'glpi_url' // Including the app token in required params
        ],
        method = 'post',
        process_tags = true,
        response;

    Object.keys(params)
        .forEach(function (key) {
            if (key.startsWith('glpi_')) {
                glpi[key.substring(5)] = params[key];
            }
            else if (required_params.indexOf(key) !== -1 && params[key] === '') {
                throw 'Parameter "' + key + '" can\'t be empty.';
            }
        });

    if ([0, 1, 2, 3].indexOf(parseInt(params.event_source)) === -1) {
        throw 'Incorrect "event_source" parameter given: ' + params.event_source + '\nMust be 0-3.';
    }

    // Check {EVENT.VALUE} for trigger-based and internal events.
    if (params.event_value !== '0' && params.event_value !== '1'
        && (params.event_source === '0' || params.event_source === '3')) {
        throw 'Incorrect "event_value" parameter given: ' + params.event_value + '\nMust be 0 or 1.';
    }

    // Check {EVENT.UPDATE.STATUS} only for trigger-based events.
    if (params.event_update_status !== '0' && params.event_update_status !== '1' && params.event_source === '0') {
        throw 'Incorrect "event_update_status" parameter given: ' + params.event_update_status + '\nMust be 0 or 1.';
    }

    if (params.event_source !== '0' && params.event_recovery_value === '0') {
        throw 'Recovery operations are supported only for trigger-based actions.';
    }

    if (typeof params.zabbix_url !== 'string' || params.zabbix_url.trim() === '' || params.zabbix_url === '{$ZABBIX.URL}') {
        throw 'Field "zabbix_url" cannot be empty.';
    }

    // Check for backslash in the end of url and schema.
    glpi.url = GLPi.urlCheckFormat(glpi.url);
    params.zabbix_url = GLPi.urlCheckFormat(params.zabbix_url);

    // Passing both token and app_token to getAuthToken
    glpi.authToken = GLPi.getAuthToken(glpi.url, glpi.token, params.glpi_app_token);
    glpi.app_token = params.glpi_app_token; // Store app_token for further requests

    GLPi.setParams(glpi);

    data = {
        'input': {
            'name': params.alert_subject,
            'content': params.alert_message + '\n<a href=' + GLPi.getProblemUrl(params.zabbix_url, params.trigger_id, params.event_id, params.event_source) + '>Link to problem in Zabbix</a>',
            'status': 1,  // Set status "New"
            'urgency': params.event_nseverity
        }
    };

    // In case of resolve
    if (params.event_source === '0' && params.event_value === '0') {
        process_tags = false;
        dataFollowup = {
            'input': {
                'items_id': glpi.problem_id,
                'itemtype': 'Problem',
                'content': params.alert_message + '\n<a href=' + GLPi.getProblemUrl(params.zabbix_url, params.trigger_id, params.event_id, params.event_source) + '>Link to problem in Zabbix</a>'
            }
        };
        dataProblem = {
            'id': glpi.problem_id,
            'input': {
                'name': params.alert_subject,
                'status': 5,  // Set status "Solved"
                'urgency': params.event_nseverity
            }
        };

        GLPi.request('put', glpi.url + 'apirest.php/Problem/' + glpi.problem_id, dataProblem);
        GLPi.request('post', glpi.url + 'apirest.php/Problem/' + glpi.problem_id + '/ITILFollowup', dataFollowup);
    }

    // In case of update
    else if (params.event_source === '0' && params.event_update_status === '1') {
        process_tags = false;
        dataFollowup = {
            'input': {
                'items_id': glpi.problem_id,
                'itemtype': 'Problem',
                'content': params.alert_message + '\n<a href=' + GLPi.getProblemUrl(params.zabbix_url, params.trigger_id, params.event_id, params.event_source) + '>Link to problem in Zabbix</a>'
            }
        };
        dataProblem = {
            'id': glpi.problem_id,
            'input': {
                'name': params.alert_subject,
                'urgency': params.event_nseverity
            }
        };

        GLPi.request('put', glpi.url + 'apirest.php/Problem/' + glpi.problem_id, dataProblem);
        GLPi.request('post', glpi.url + 'apirest.php/Problem/' + glpi.problem_id + '/ITILFollowup', dataFollowup);
    }

    // In case of problem
    else {
        response = GLPi.request('post', glpi.url + 'apirest.php/Problem/', data);
    }

    if (process_tags) {
        result.tags.__zbx_glpi_problem_id = response.id;
        result.tags.__zbx_glpi_link = glpi.url + 'front/problem.form.php?id=' + response.id;
    }

    Zabbix.log(4, '[ GLPi Webhook ] Result: ' + JSON.stringify(result));
    return JSON.stringify(result);
}
catch (error) {
    Zabbix.log(4, '[ GLPi Webhook ] ERROR: ' + error);
    throw 'Sending failed: ' + error;
}