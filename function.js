window.function = async function(api_key, assistant_id, file_urls, user_message) {
    if (!api_key.value) return "Error: OpenAI API Key is required.";
    if (!assistant_id.value) return "Error: Assistant ID is required.";

    const openaiEndpoint = "https://api.openai.com/v1";
    let vectorStoreId = null;

    try {
        // Step 1: If file URLs exist, download content and create a vector store
        if (file_urls.value) {
            const urls = file_urls.value.split(",").map(url => url.trim());
            const fileIds = [];

            for (const url of urls) {
                try {
                    const fileResponse = await fetch(url);
                    if (!fileResponse.ok) continue;

                    const blob = await fileResponse.blob();
                    const fileName = url.split("/").pop().split("?")[0]; // Extract filename from URL

                    const formData = new FormData();
                    formData.append("file", blob, fileName);
                    formData.append("purpose", "assistants");

                    const fileUploadResponse = await fetch(`${openaiEndpoint}/files`, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${api_key.value}`
                        },
                        body: formData
                    });

                    if (!fileUploadResponse.ok) continue;

                    const fileData = await fileUploadResponse.json();
                    fileIds.push(fileData.id);
                } catch (err) {
                    console.error(`Error processing file ${url}: ${err.message}`);
                }
            }

            if (fileIds.length > 0) {
                const vectorStoreResponse = await fetch(`${openaiEndpoint}/vector_stores`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${api_key.value}`
                    },
                    body: JSON.stringify({ file_ids: fileIds })
                });

                if (vectorStoreResponse.ok) {
                    const vectorStoreData = await vectorStoreResponse.json();
                    vectorStoreId = vectorStoreData.id;
                }
            }
        }

        // Step 2: Create a thread and run it
        const runPayload = {
            assistant_id: assistant_id.value,
            thread: {
                messages: user_message.value ? [
                    { role: "user", content: user_message.value }
                ] : []
            },
            tool_resources: vectorStoreId ? { file_search: { vector_store_ids: [vectorStoreId] } } : undefined
        };

        const runResponse = await fetch(`${openaiEndpoint}/threads/runs`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${api_key.value}`,
                "OpenAI-Beta": "assistants=v2"
            },
            body: JSON.stringify(runPayload)
        });

        if (!runResponse.ok) {
            const errorData = await runResponse.json();
            return `Error starting thread and run: ${errorData.error?.message || "Unknown error"}`;
        }

        const runData = await runResponse.json();
        return JSON.stringify(runData, null, 2);

    } catch (error) {
        return `Error: ${error.message}`;
    }
};
