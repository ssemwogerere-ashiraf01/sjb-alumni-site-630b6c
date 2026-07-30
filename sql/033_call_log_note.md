# Calls

1. Enable Realtime for `chat_calls` (Dashboard → Database → Publications → supabase_realtime).
2. Use HTTPS or localhost (getUserMedia requires secure context).
3. Both users must allow microphone (and camera for video).
4. STUN-only may fail on strict mobile networks; TURN server needed for production reliability.
5. Call events appear in DM chat as "Voice call · m:ss" / "Video call · m:ss" (no conversation content recorded).
