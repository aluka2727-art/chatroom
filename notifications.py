from flask import Blueprint, jsonify, request, session
from pywebpush import WebPushException, webpush

# 1. Initialize the Blueprint instead of using 'app'
notifications_bp = Blueprint("notifications", __name__)


def send_dm_push(db, recipient_id, sender_id, sender_username):
    """
    Helper function to send a Web Push notification to a recipient user.
    Adjust database query fields based on your actual schema.
    """
    # Example: Fetch push subscriptions for the recipient from your database
    subscriptions = db.execute(
        "SELECT subscription_info FROM push_subscriptions WHERE user_id = ?",
        (recipient_id,),
    ).fetchall()

    for sub in subscriptions:
        try:
            # Send notification using pywebpush
            webpush(
                subscription_info=sub["subscription_info"],
                data=f"New message from {sender_username}",
                # Ensure VAPID keys and claims are configured as needed:
                # vapid_private_key="YOUR_PRIVATE_KEY",
                # vapid_claims={"sub": "mailto:your-email@example.com"}
            )
        except WebPushException as ex:
            # Handle expired or invalid subscriptions
            print(f"WebPush failed: {ex}")


@notifications_bp.route("/api/send-message", methods=["POST"])
def send_message():
    data = request.get_json() or {}
    recipient_id = data.get("recipient_id")
    message_text = data.get("message")
    sender_id = session.get("user_id")
    sender_username = session.get("username")

    if not sender_id:
        return jsonify({"success": False, "error": "Unauthorized"}), 401

    if not recipient_id or not message_text:
        return jsonify({"success": False, "error": "Missing required fields"}), 400

    # Access your database instance (e.g., from g, your app context, or imported db helper)
    # 1. Save the message to your database
    # db.execute("INSERT INTO messages (sender_id, recipient_id, body) VALUES (?, ?, ?)",
    #            (sender_id, recipient_id, message_text))

    # 2. Trigger the push notification
    # send_dm_push(db, recipient_id, sender_id, sender_username)

    return jsonify({"success": True})