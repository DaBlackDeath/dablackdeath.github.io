import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import json
import os

class MixJSONEditor:
    def __init__(self, root):
        self.root = root
        self.root.title("Mix JSON Editor - Name & Source")
        self.root.geometry("900x650")
        
        # Aktuelle Daten
        self.json_path = None
        self.data = []
        self.selected_index = -1
        
        # GUI erstellen
        self.create_widgets()
        
        # Automatisch nach mixes.json suchen
        if os.path.exists("mixes.json"):
            self.json_path = "mixes.json"
            self.load_json()
    
    def create_widgets(self):
        # Hauptframe
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Toolbar
        toolbar = ttk.Frame(main_frame)
        toolbar.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Button(toolbar, text="📂 JSON laden", command=self.load_json_dialog).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="💾 Speichern", command=self.save_json).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="💾 Speichern unter...", command=self.save_json_as).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="➕ Neuer Eintrag", command=self.add_new_item).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="⬆️ Nach oben", command=self.move_up).pack(side=tk.LEFT, padx=5)
        ttk.Button(toolbar, text="⬇️ Nach unten", command=self.move_down).pack(side=tk.LEFT, padx=5)
        
        # Info über geladene Datei
        self.file_info_var = tk.StringVar(value="Keine Datei geladen")
        info_label = ttk.Label(main_frame, textvariable=self.file_info_var, font=("Arial", 9, "italic"))
        info_label.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # Split-Pane für Liste und Editor
        paned = ttk.PanedWindow(main_frame, orient=tk.HORIZONTAL)
        paned.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Linke Seite: Liste
        list_frame = ttk.Frame(paned)
        paned.add(list_frame, weight=1)
        
        # Überschrift für Liste
        list_header = ttk.LabelFrame(list_frame, text="Mix Einträge", padding="5")
        list_header.pack(fill=tk.BOTH, expand=True)
        
        # Scrollbare Liste
        list_inner = ttk.Frame(list_header)
        list_inner.pack(fill=tk.BOTH, expand=True)
        
        scrollbar = ttk.Scrollbar(list_inner)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.item_listbox = tk.Listbox(list_inner, yscrollcommand=scrollbar.set, height=20)
        self.item_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.item_listbox.yview)
        
        # Listbox-Bindings
        self.item_listbox.bind('<<ListboxSelect>>', self.on_listbox_select)
        
        # Buttons unter der Liste
        list_buttons = ttk.Frame(list_header)
        list_buttons.pack(fill=tk.X, pady=(5, 0))
        
        ttk.Button(list_buttons, text="🗑️ Löschen", command=self.delete_item).pack(side=tk.LEFT, padx=2)
        ttk.Button(list_buttons, text="📋 Duplizieren", command=self.duplicate_item).pack(side=tk.LEFT, padx=2)
        
        # Rechte Seite: Editor
        edit_frame = ttk.Frame(paned)
        paned.add(edit_frame, weight=2)
        
        # Editor-Überschrift
        editor_header = ttk.LabelFrame(edit_frame, text="Mix bearbeiten", padding="5")
        editor_header.pack(fill=tk.BOTH, expand=True)
        
        # Editor-Inhalt
        edit_content = ttk.Frame(editor_header)
        edit_content.pack(fill=tk.BOTH, expand=True, padx=10, pady=20)
        
        # Name Feld
        ttk.Label(edit_content, text="Name:", font=("Arial", 10, "bold")).grid(row=0, column=0, sticky=tk.W, pady=10)
        self.name_var = tk.StringVar()
        name_entry = ttk.Entry(edit_content, textvariable=self.name_var, width=50, font=("Arial", 10))
        name_entry.grid(row=0, column=1, sticky=tk.W, pady=10, padx=(10, 0))
        
        # Source URL Feld
        ttk.Label(edit_content, text="Source URL:", font=("Arial", 10, "bold")).grid(row=1, column=0, sticky=tk.W, pady=10)
        self.src_var = tk.StringVar()
        src_entry = ttk.Entry(edit_content, textvariable=self.src_var, width=50, font=("Arial", 10))
        src_entry.grid(row=1, column=1, sticky=tk.W, pady=10, padx=(10, 0))
        
        # Buttons für Bearbeitung
        button_frame = ttk.Frame(edit_content)
        button_frame.grid(row=2, column=0, columnspan=2, pady=30)
        
        ttk.Button(button_frame, text="💾 Änderungen speichern", command=self.save_current_item, width=20).pack(side=tk.LEFT, padx=5)
        ttk.Button(button_frame, text="🔄 Felder leeren", command=self.clear_fields, width=20).pack(side=tk.LEFT, padx=5)
        
        # Statusleiste
        status_frame = ttk.Frame(main_frame)
        status_frame.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(10, 0))
        
        self.status_var = tk.StringVar(value="Bereit")
        status_label = ttk.Label(status_frame, textvariable=self.status_var, relief=tk.SUNKEN, anchor=tk.W)
        status_label.pack(fill=tk.X)
        
        # Gewichte setzen
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(2, weight=1)
        
        # Tastatur-Shortcuts
        self.root.bind('<Control-s>', lambda e: self.save_json())
        self.root.bind('<Control-o>', lambda e: self.load_json_dialog())
        self.root.bind('<Control-n>', lambda e: self.add_new_item())
    
    def load_json_dialog(self):
        """Öffnet Dialog zum Laden einer JSON-Datei"""
        file_path = filedialog.askopenfilename(
            title="JSON-Datei laden",
            filetypes=[("JSON Dateien", "*.json"), ("Alle Dateien", "*.*")]
        )
        if file_path:
            self.json_path = file_path
            self.load_json()
    
    def load_json(self):
        """Lädt die JSON-Datei"""
        if not self.json_path:
            self.status_var.set("Keine Datei ausgewählt")
            return
        
        try:
            with open(self.json_path, 'r', encoding='utf-8') as f:
                loaded_data = json.load(f)
            
            # Prüfen ob es eine Liste ist
            if isinstance(loaded_data, list):
                self.data = loaded_data
                # Validiere das Format
                self.validate_and_fix_format()
                self.file_info_var.set(f"📄 {os.path.basename(self.json_path)} - {len(self.data)} Einträge")
            else:
                messagebox.showerror("Fehler", "Die JSON-Datei enthält keine Liste.")
                return
            
            self.update_listbox()
            self.clear_fields()
            self.status_var.set(f"Geladen: {os.path.basename(self.json_path)}")
            self.selected_index = -1
            
        except json.JSONDecodeError as e:
            messagebox.showerror("JSON-Fehler", f"Ungültiges JSON-Format:\n{e}")
            self.status_var.set("Fehler beim Laden")
        except Exception as e:
            messagebox.showerror("Fehler", f"Fehler beim Laden: {e}")
    
    def validate_and_fix_format(self):
        """Validiert und korrigiert das Format der Daten"""
        for i, item in enumerate(self.data):
            if not isinstance(item, dict):
                self.data[i] = {"name": "", "src": ""}
                continue
            
            # Stelle sicher, dass name und src existieren
            if "name" not in item:
                self.data[i]["name"] = ""
            if "src" not in item:
                self.data[i]["src"] = ""
            
            # Entferne unnötige Felder
            valid_keys = ["name", "src"]
            for key in list(item.keys()):
                if key not in valid_keys:
                    del self.data[i][key]
    
    def save_json(self):
        """Speichert die JSON-Datei"""
        if not self.json_path:
            self.save_json_as()
            return
        
        try:
            # Vor dem Speichern das Format validieren
            self.validate_and_fix_format()
            
            with open(self.json_path, 'w', encoding='utf-8') as f:
                json.dump(self.data, f, indent=2, ensure_ascii=False)
            self.status_var.set(f"Gespeichert: {os.path.basename(self.json_path)}")
            messagebox.showinfo("Erfolg", "Datei erfolgreich gespeichert!")
        except Exception as e:
            messagebox.showerror("Fehler", f"Fehler beim Speichern: {e}")
    
    def save_json_as(self):
        """Speichert die JSON-Datei unter neuem Namen"""
        file_path = filedialog.asksaveasfilename(
            title="JSON speichern unter...",
            defaultextension=".json",
            filetypes=[("JSON Dateien", "*.json"), ("Alle Dateien", "*.*")]
        )
        if file_path:
            self.json_path = file_path
            self.save_json()
    
    def update_listbox(self):
        """Aktualisiert die Listbox"""
        self.item_listbox.delete(0, tk.END)
        for i, item in enumerate(self.data):
            name = item.get('name', '').strip()
            display_name = name if name else f"(Unbenannt {i+1})"
            self.item_listbox.insert(tk.END, f"{i+1}. {display_name}")
    
    def on_listbox_select(self, event):
        """Wird aufgerufen wenn ein Eintrag in der Listbox ausgewählt wird"""
        selection = self.item_listbox.curselection()
        if selection:
            self.selected_index = selection[0]
            self.load_item_to_editor(self.selected_index)
    
    def load_item_to_editor(self, index):
        """Lädt einen Eintrag in den Editor"""
        if 0 <= index < len(self.data):
            item = self.data[index]
            self.name_var.set(item.get('name', ''))
            self.src_var.set(item.get('src', ''))
            self.status_var.set(f"Bearbeite: {item.get('name', 'Unbenannt')}")
    
    def save_current_item(self):
        """Speichert den aktuell bearbeiteten Eintrag"""
        if self.selected_index < 0:
            messagebox.showwarning("Warnung", "Bitte wähle zuerst einen Eintrag aus.")
            return
        
        name = self.name_var.get().strip()
        src = self.src_var.get().strip()
        
        if not name:
            messagebox.showwarning("Warnung", "Bitte einen Namen eingeben.")
            return
        
        if not src:
            messagebox.showwarning("Warnung", "Bitte eine Source URL eingeben.")
            return
        
        # Prüfen ob Name bereits existiert (außer beim aktuellen Eintrag)
        for i, item in enumerate(self.data):
            if i != self.selected_index and item.get('name') == name:
                messagebox.showwarning("Warnung", "Ein Mix mit diesem Namen existiert bereits.")
                return
        
        # Aktualisieren
        self.data[self.selected_index] = {"name": name, "src": src}
        self.update_listbox()
        self.status_var.set(f"Mix aktualisiert: {name}")
        
        # Listbox-Selektion beibehalten
        self.item_listbox.selection_set(self.selected_index)
        self.item_listbox.see(self.selected_index)
    
    def add_new_item(self):
        """Fügt einen neuen leeren Eintrag hinzu"""
        # Neuen Eintrag mit den Template-Feldern
        new_item = {"name": "", "src": ""}
        self.data.append(new_item)
        self.update_listbox()
        
        # Zum neuen Eintrag springen
        new_index = len(self.data) - 1
        self.item_listbox.selection_set(new_index)
        self.item_listbox.see(new_index)
        self.selected_index = new_index
        self.load_item_to_editor(new_index)
        
        self.status_var.set(f"Neuer Eintrag hinzugefügt (Platz {new_index + 1})")
        
        # Fokus auf Name-Feld setzen
        self.name_var.set("")
        self.src_var.set("")
        self.name_var.focus()
    
    def delete_item(self):
        """Löscht den ausgewählten Eintrag"""
        selection = self.item_listbox.curselection()
        if not selection:
            messagebox.showwarning("Warnung", "Bitte wähle einen Eintrag aus.")
            return
        
        index = selection[0]
        name = self.data[index].get('name', 'Unbenannt')
        
        if messagebox.askyesno("Löschen bestätigen", 
                               f"Möchtest du den Mix '{name}' wirklich löschen?"):
            del self.data[index]
            self.update_listbox()
            self.clear_fields()
            self.selected_index = -1
            self.status_var.set(f"Mix gelöscht: {name}")
    
    def duplicate_item(self):
        """Dupliziert den ausgewählten Eintrag"""
        selection = self.item_listbox.curselection()
        if not selection:
            messagebox.showwarning("Warnung", "Bitte wähle einen Eintrag aus.")
            return
        
        index = selection[0]
        item = self.data[index]
        
        # Neue Kopie mit angepasstem Namen
        import copy
        new_item = copy.deepcopy(item)
        
        # Wenn der Name mit "(Kopie)" endet, Nummer erhöhen
        name = new_item.get('name', '')
        if "(Kopie" in name:
            import re
            base_name = re.sub(r'\s*\(Kopie\s*\d*\)$', '', name)
            existing_copies = [i for i, it in enumerate(self.data) if it.get('name', '').startswith(base_name)]
            new_item['name'] = f"{base_name} (Kopie {len(existing_copies) + 1})"
        else:
            new_item['name'] = f"{name} (Kopie)"
        
        self.data.append(new_item)
        self.update_listbox()
        
        new_index = len(self.data) - 1
        self.item_listbox.selection_set(new_index)
        self.item_listbox.see(new_index)
        self.selected_index = new_index
        self.load_item_to_editor(new_index)
        
        self.status_var.set(f"Mix dupliziert: {new_item['name']}")
    
    def move_up(self):
        """Verschiebt den ausgewählten Eintrag nach oben"""
        selection = self.item_listbox.curselection()
        if not selection or selection[0] == 0:
            return
        
        index = selection[0]
        self.data[index], self.data[index-1] = self.data[index-1], self.data[index]
        self.update_listbox()
        self.item_listbox.selection_set(index-1)
        self.item_listbox.see(index-1)
        self.selected_index = index-1
        self.status_var.set("Nach oben verschoben")
    
    def move_down(self):
        """Verschiebt den ausgewählten Eintrag nach unten"""
        selection = self.item_listbox.curselection()
        if not selection or selection[0] >= len(self.data)-1:
            return
        
        index = selection[0]
        self.data[index], self.data[index+1] = self.data[index+1], self.data[index]
        self.update_listbox()
        self.item_listbox.selection_set(index+1)
        self.item_listbox.see(index+1)
        self.selected_index = index+1
        self.status_var.set("Nach unten verschoben")
    
    def clear_fields(self):
        """Leert die Bearbeitungsfelder"""
        self.name_var.set('')
        self.src_var.set('')
        self.selected_index = -1

if __name__ == "__main__":
    root = tk.Tk()
    app = MixJSONEditor(root)
    root.mainloop()