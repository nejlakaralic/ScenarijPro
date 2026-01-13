const PoziviAjaxFetch = (function () {

    function request(method, url, body, callback) {
        const options = {
            method: method,
            headers: { "Content-Type": "application/json" }
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        fetch(url, options)
            .then(async response => {
                const data = await response.json().catch(() => ({}));
                callback(response.status, data);
            })
            .catch(error => {
                callback(0, { message: error.message });
            });
    }

    return {

        postScenario: function (title, callback) {
            request(
                "POST",
                "/api/scenarios",
                { title: title },
                callback
            );
        },

        getScenario: function (scenarioId, callback) {
            request(
                "GET",
                `/api/scenarios/${scenarioId}`,
                null,
                callback
            );
        },

        lockLine: function (scenarioId, lineId, userId, callback) {
            request(
                "POST",
                `/api/scenarios/${scenarioId}/lines/${lineId}/lock`,
                { userId: userId },
                callback
            );
        },

        updateLine: function (scenarioId, lineId, userId, newText, callback) {
            request(
                "PUT",
                `/api/scenarios/${scenarioId}/lines/${lineId}`,
                { userId: userId, newText: newText },
                callback
            );
        },

        lockCharacter: function (scenarioId, characterName, userId, callback) {
            request(
                "POST",
                `/api/scenarios/${scenarioId}/characters/lock`,
                { userId: userId, characterName: characterName },
                callback
            );
        },

        updateCharacter: function (scenarioId, userId, oldName, newName, callback) {
            request(
                "POST",
                `/api/scenarios/${scenarioId}/characters/update`,
                { userId: userId, oldName: oldName, newName: newName },
                callback
            );
        },

        getDeltas: function (scenarioId, since, callback) {
            request(
                "GET",
                `/api/scenarios/${scenarioId}/deltas?since=${since}`,
                null,
                callback
            );
        }
    };

})();