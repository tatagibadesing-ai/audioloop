import os
import uuid
import asyncio
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import edge_tts

app = FastAPI()

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

TEMP_DIR = "temp_audio"
os.makedirs(TEMP_DIR, exist_ok=True)

async def generate_audio_file(text, voice, output_path):
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(output_path)

def cleanup_file(path: str):
    try:
        if os.path.exists(path):
            os.remove(path)
            print(f"Deleted temp file: {path}")
    except Exception as e:
        print(f"Error deleting file {path}: {e}")

from pydantic import BaseModel

class AudioRequest(BaseModel):
    text: str
    voice: str

@app.post("/generate")
async def generate_audio(request: AudioRequest, background_tasks: BackgroundTasks):
    if not request.text:
        raise HTTPException(status_code=400, detail="Text is required")
    
    # Secure filename
    filename = f"{uuid.uuid4()}.mp3"
    file_path = os.path.join(TEMP_DIR, filename)
    
    try:
        # Generate audio
        await generate_audio_file(request.text, request.voice, file_path)
        
        # Schedule cleanup after response is sent
        background_tasks.add_task(cleanup_file, file_path)
        
        return FileResponse(
            file_path, 
            media_type="audio/mpeg", 
            filename="audiobook.mp3"
        )
    except Exception as e:
        # If generation fails, try to cleanup even if it didn't finish
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
