import json
import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog

class JsonEditor:
    def __init__(self, root):
        self.root = root
        self.root.title("JSON Editor")
        self.data = []
        self.file_path = None

        # UI
        self.listbox = tk.Listbox(root, width=60, height=20)
        self.listbox.pack(padx=10, pady=10)
        self.listbox.bind("<<ListboxSelect>>", self.on_select)

        btn_frame = tk.Frame(root)
        btn_frame.pack()

        tk.Button(btn_frame, text="JSON laden", command=self.load_json).grid(row=0, column=0, padx=5)
        tk.Button(btn_frame, text="Eintrag bearbeiten", command=self.edit_entry).grid(row=0, column=1, padx=5)
        tk.Button(btn_frame, text="Eintrag löschen", command=self.delete_entry).grid(row=0, column=2, padx=5)
        tk.Button(btn_frame, text="Neu hinzufügen", command=self.add_entry).grid(row=0, column=3, padx=5)
        tk.Button(btn_frame, text="Speichern", command=self.save_json).grid(row=0, column=4, padx=5)

    def load_json(self):
        path = filedialog.askopenfilename(filetypes=[("JSON Dateien", "*.json")])
        if not path:
            return
        self.file_path = path

        with open(path, "r", encoding="utf-8") as f:
            self.data = json.load(f)

        self.refresh_list()

    def refresh_list(self):
        self.listbox.delete(0, tk.END)
        for entry in self.data:
            self.listbox.insert(tk.END, f"{entry['name']}  →  {entry['src']}")

    def on_select(self, event):
        pass  # optional

    def edit_entry(self):
        idx = self.listbox.curselection()
        if not idx:
            messagebox.showwarning("Hinweis", "Bitte einen Eintrag auswählen")
            return

        index = idx[0]
        entry = self.data[index]

        new_name = simpledialog.askstring("Name bearbeiten", "Neuer Name:", initialvalue=entry["name"])
        if new_name is None:
            return

        new_src = simpledialog.askstring("SRC bearbeiten", "Neue SRC:", initialvalue=entry["src"])
        if new_src is None:
            return

        self.data[index]["name"] = new_name
        self.data[index]["src"] = new_src
        self.refresh_list()

    def delete_entry(self):
        idx = self.listbox.curselection()
        if not idx:
            messagebox.showwarning("Hinweis", "Bitte einen Eintrag auswählen")
            return

        index = idx[0]
        del self.data[index]
        self.refresh_list()

    def add_entry(self):
        name = simpledialog.askstring("Neuer Eintrag", "Name:")
        if name is None:
            return

        src = simpledialog.askstring("Neuer Eintrag", "SRC:")
        if src is None:
            return

        self.data.append({"name": name, "src": src})
        self.refresh_list()

    def save_json(self):
        if not self.file_path:
            messagebox.showwarning("Fehler", "Keine Datei geladen")
            return

        with open(self.file_path, "w", encoding="utf-8") as f:
            json.dump(self.data, f, indent=2, ensure_ascii=False)

        messagebox.showinfo("Gespeichert", "JSON erfolgreich gespeichert!")

root = tk.Tk()
app = JsonEditor(root)
root.mainloop()
