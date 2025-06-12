import mqtt from "mqtt"

let logBuffer = []

self.onmessage = function (event) {
	const { stream, eventType, timestamp, payload, vantagePointID } = event.data

	const logMessage = { stream, eventType: checkMoQLogCompatibility(eventType), timestamp, payload, vantagePointID }
	// console.log("Logging event in onmessage:", logMessage)
	logBuffer.push(logMessage)
}

function checkMoQLogCompatibility(event_type) {
	const moqlSupportedTypes = [
		"connect-sent",
		"announce-sent",
		"announce-received",
		"announce-ok-sent",
		"announce-ok-received",
		"subscribe-sent",
		"subscribe-received",
		"subscribe-ok-sent",
		"subscribe-ok-received",
		// Add latency-related event types
		"segment-sent",
		"segment-received",
		"segment-player-received",
	]
	if (moqlSupportedTypes.includes(event_type)) {
		return "moq:" + event_type
	} else {
		return "moq-custom:" + event_type
	}
}

const replacer = (key, value) => {
	if (typeof value === "bigint") {
		return value.toString()
	}
	return value
}

setInterval(() => {
	if (logBuffer.length === 0) return

	const bufferLength = logBuffer.length // Use number type for consistency

	const stringifiedMessageArray = logBuffer.map((logObject) => JSON.stringify(logObject, replacer))

	// Combine to send over mqtt
	const mqttPayload = {
		bufferLength: bufferLength, // Send as number
		messageArray: stringifiedMessageArray, // Send array of JSON strings
	}

	// Stringify the outer payload
	client.publish(
		"logging-stream",
		JSON.stringify(mqttPayload), // No need for replacer here, BigInts are already strings
	)
	logBuffer = [] // Clear the original buffer of objects
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
