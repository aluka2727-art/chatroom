@app.route("/api/send-message", methods=["POST"])
def send_message():
    data = request.get_json()
    recipient_id = data.get("recipient_id")
    message_text = data.get("message")
    sender_id = session.get("user_id")
    sender_username = session.get("username")

    # 1. Save the message to your database...
    # db.execute("INSERT INTO messages ...")

    # 2. Trigger the push notification to the recipient!
    send_dm_push(db, recipient_id, sender_id, sender_username)

    return jsonify({"success": True})