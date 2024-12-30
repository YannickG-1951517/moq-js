import mqtt from "mqtt"

self.onmessage = function (event) {
	const { stream, eventType, timestamp, payload } = event.data

	const logMessage = { eventType, timestamp, payload }
	console.log("Logging event in onmessage:", logMessage)
	client.publish(stream, JSON.stringify(logMessage))
}

const client = mqtt.connect("ws://localhost:9001")
client.on("connect", () => {
	console.log("Connected to MQTT broker")
	client.publish("logging-stream", "Connected to MQTT broker")
})

client.on("error", (error) => {
	console.error("MQTT connection error:", error)
})
