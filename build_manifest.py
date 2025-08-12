#!/usr/bin/env python3
# filepath: /srv/www/htdocs/group/avic5/build_manifest.py
"""
Walk /DO-PE_Conver_HTML and create:
  • manifest.json      – nested dict for the frontend
  • thumbs/{run}/{png} – 320‑px WebP placeholders (optional)
"""
import json, re, os
from PIL import Image

ROOT = "DO-PE_Conver_HTML"
THUMB_DIR = "thumbs"
regex = re.compile(r"(?P<var>\w+)_.*_z(?P<z>\d{3})_t_(?P<t>\d{3})\.png")

# Folder => DO‑PE Convergence
folder_map = {
    "2D_Fields": "mean",
    "Diff": "mean_diff",
    "Diff_ext": "mean_diff_ext"
}

manifest = {"runs": {}}

for run in sorted(p for p in os.listdir(ROOT) if p.startswith("Run")):
    r_id = run.replace("Run", "")
    run_data = manifest["runs"].setdefault(r_id, {})

    # e.g. scanning DO-PE_Conver_HTML/Run124/figs/mean
    for root, _, files in os.walk(os.path.join(ROOT, run, "figs", "mean")):
        folder_name = os.path.basename(root)  # "2D_Fields", "Diff", or "Diff_ext"
        subfolder_key = folder_map.get(folder_name)
        if not subfolder_key:
            continue  # unrecognized subfolder

        for f in files:
            if not f.endswith(".png"):
                continue
            mo = regex.search(f)
            if not mo:
                continue  # skip if it doesn't match var_z###_t_###.png

            var_full = mo.group("var")  # e.g. "salt_mean_diff", "total_vel_mean", etc.
            # Strip _mean / _mean_diff / _mean_diff_ext if they appear at the end
            var_name = re.sub(r'(_mean_diff_ext|_mean_diff|_mean)$', '', var_full)
            # Rename total_vel → vel
            if var_name == "total_vel":
                var_name = "vel"
            z_val  = mo.group("z")   # e.g. "000"
            t_val  = int(mo.group("t"))  # e.g. 8

            # run_data[var][z_val][convergence] => array of image paths
            var_data  = run_data.setdefault(var_name, {})
            elev_data = var_data.setdefault(z_val, {})
            arr       = elev_data.setdefault(subfolder_key, [])

            # Make sure the list fits index (t_val - 1)
            while len(arr) < t_val:
                arr.append(None)
            arr[t_val - 1] = os.path.relpath(os.path.join(root, f), ".")

            # Optional: create a thumbnail
            thumb_dir  = os.path.join(THUMB_DIR, run)
            os.makedirs(thumb_dir, exist_ok=True)
            thumb_path = os.path.join(thumb_dir, f.replace(".png", ".webp"))

# Write out the final JSON
with open("manifest.json", "w") as fp:
    json.dump(manifest, fp, indent=2)
print("manifest.json & thumbnails updated.")