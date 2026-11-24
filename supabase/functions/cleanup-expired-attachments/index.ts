import { withSupabase } from "npm:@supabase/server@1";

const storageBucket = "chat-attachments";
const batchSize = 100;

Deno.serve(
  withSupabase({ auth: "secret" }, async (_request, context) => {
    const { data: paths, error: markError } = await context.supabaseAdmin.rpc(
      "mark_expired_attachments"
    );
    if (markError) {
      console.error("Could not find expired attachments:", markError);
      return Response.json({ error: "Could not find expired attachments." }, { status: 500 });
    }

    let removed = 0;
    for (let index = 0; index < (paths ?? []).length; index += batchSize) {
      const batch = paths.slice(index, index + batchSize);
      const { error: removeError } = await context.supabaseAdmin.storage
        .from(storageBucket)
        .remove(batch);
      if (removeError) {
        console.error("Could not remove expired attachments:", removeError);
        return Response.json({ error: "Could not remove expired attachments." }, { status: 500 });
      }

      const { error: finalizeError } = await context.supabaseAdmin.rpc(
        "finalize_expired_attachments",
        { deleted_paths: batch }
      );
      if (finalizeError) {
        console.error("Could not finalize expired attachments:", finalizeError);
        return Response.json({ error: "Could not finalize expired attachments." }, { status: 500 });
      }
      removed += batch.length;
    }

    return Response.json({ removed });
  })
);
