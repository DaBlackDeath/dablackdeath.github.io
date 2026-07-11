import json

# 1. Dateien laden
with open('loops.json', 'r', encoding='utf-8') as f1, open('mixes.json', 'r', encoding='utf-8') as f2:
    data1 = json.load(f1)
    data2 = json.load(f2)

# 2. Listen kombinieren
combined_data = data1 + data2

# Optional: Duplikate nach Name filtern
seen = set()
unique_data = []
for item in combined_data:
    if item['name'] not in seen:
        seen.add(item['name'])
        unique_data.append(item)

# 3. Speichern
with open('playlist.json', 'w', encoding='utf-8') as f_out:
    json.dump(unique_data, f_out, ensure_ascii=False, indent=2)

print("Playlists erfolgreich zusammengeführt!")