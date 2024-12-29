self.onmessage = function (event) {
	const { type, payload } = event.data

	if (type === "LOG_EVENT") {
		console.log("Logging event:", payload)
		sendLogToServer(payload)
	}
}

const ws = new WebSocket("ws://localhost:3211")
ws.onopen = async function () {
	console.log("Connected to server")
	logDataBuffer.forEach((entry) => {
		ws.send(JSON.stringify(entry))
	})
}

let logDataBuffer = []

// Function to send the log data to the server
function sendLogToServer(logEntry) {
	if (ws.readyState != ws.OPEN) {
		logDataBuffer.push(logEntry)
		return
	} else if (logDataBuffer.length > 0) {
		logDataBuffer.forEach((entry) => {
			ws.send(JSON.stringify(entry))
		})
		logDataBuffer = []
		return
	}
	ws.send(JSON.stringify(logEntry))
}

function tempSend() {
	
}
