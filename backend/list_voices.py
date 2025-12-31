import asyncio
import edge_tts

async def list_voices():
    voices = await edge_tts.VoicesManager.create()
    pt_br_voices = voices.find(Language="pt", Locale="pt-BR")
    for v in pt_br_voices:
        print(v['ShortName'])

if __name__ == "__main__":
    asyncio.run(list_voices())
