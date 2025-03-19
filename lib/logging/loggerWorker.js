import mqtt from "mqtt"

let logBuffer = []

self.onmessage = function (event) {
	const { stream, eventType, timestamp, payload } = event.data

	const logMessage = { eventType: checkMoQLogCompatibility(eventType), timestamp, payload }
	// console.log("Logging event in onmessage:", logMessage)
	logBuffer.push(logMessage)
}

function checkMoQLogCompatibility(event_type) {
	const moqlSupportedTypes = ["subscribe", "unsubscribe", "segment-received"]
	if (moqlSupportedTypes.includes(event_type)) {
		return "moq:" + event_type
	} else {
		return "moq-custom:" + event_type
	}
}

setInterval(() => {
	if (logBuffer.length === 0) return
	// console.log("Flushing buffer to MQTT broker", logBuffer)
	const bufferLength = logBuffer.length.toString()
	// console.log("bufferLength:", bufferLength)

	// combine to send over mqtt
	const mqttPayload = {
		bufferLength: bufferLength,
		messageArray: logBuffer,
	}

	client.publish("logging-stream", JSON.stringify(mqttPayload)) // Flush buffer to MQTT broker (topic, payload)
	logBuffer = []
}, 1000)

const client = mqtt.connect("ws://localhost:9001")

// * check temporarily removed because formatting was wrong on publish and cant be bothered to fix it
// client.on("connect", () => {
// 	console.log("Connected to MQTT broker")
// 	client.publish("logging-stream", "Connected to MQTT broker")
// })

client.on("error", (error) => {
	console.error("MQTT connection error:", error)
})
