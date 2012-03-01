package org.kvj.dict;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;

import org.json.JSONArray;
import org.json.JSONObject;

import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.util.Log;

import com.phonegap.api.Plugin;
import com.phonegap.api.PluginResult;
import com.phonegap.api.PluginResult.Status;

public class DictPlugin extends Plugin {

	private DBHelper db = null;

	public DictPlugin() {
	}

	@Override
	public boolean isSynch(String action) {
		return true;
	}

	private static final String TAG = "DictPlugin";

	@Override
	public PluginResult execute(String action, JSONArray params, String callback) {
		if ("open".equals(action)) {
			try {
				String path = params.getString(0);
				Log.i(TAG, "Open DB: " + path);
				if (open(path)) {
					Log.i(TAG, "Dict DB opened");
					return new PluginResult(Status.OK, true);
				} else {
					return new PluginResult(Status.IO_EXCEPTION,
							"Error opening DB");
				}
			} catch (Exception e) {
				e.printStackTrace();
			}
			return new PluginResult(Status.OK, true);
		}
		if ("query".equals(action)) {
			if (null == db) {
				return new PluginResult(Status.IO_EXCEPTION, "DB not opened");
			}
			try {
				String query = params.getString(0);
				JSONArray args = params.getJSONArray(1);
				String[] whereArgs = new String[args.length()];
				for (int i = 0; i < whereArgs.length; i++) {
					whereArgs[i] = args.getString(i);
				}
				String where = query.substring(query.indexOf("where")
						+ "where".length());
				String order = null;
				if (where.indexOf("order by") != -1) {
					order = where.substring(where.indexOf("order by")
							+ "order by".length() + 1);
					where = where.substring(0, where.indexOf("order by"));
				}
				// Log.i(TAG, "Exec: " + query + ", " + where + ", " + order
				// + ", " + whereArgs);
				Cursor c = db.getDatabase().query("dict",
						new String[] { "kanji", "kana", "entry" }, where,
						whereArgs, null, null, order);
				JSONArray result = new JSONArray();
				if (c.moveToFirst()) {
					do {
						JSONObject obj = new JSONObject();
						obj.put("kanji", c.getString(0));
						obj.put("kana", c.getString(1));
						obj.put("entry", c.getString(2));
						result.put(obj);
					} while (c.moveToNext());
				}
				c.close();
				return new PluginResult(Status.OK, result);
			} catch (Exception e) {
				e.printStackTrace();
			}
			return new PluginResult(Status.IO_EXCEPTION, "Query error");
		}
		return new PluginResult(Status.INVALID_ACTION);
	}

	private boolean open(String path) {
		String fileName = path;
		if (fileName.indexOf("/") != -1) {
			fileName = fileName.substring(fileName.lastIndexOf('/') + 1);
		}
		try {
			File file = new File(ctx.getExternalCacheDir(), fileName);
			if (!file.exists()) {
				byte[] buffer = new byte[2048];
				BufferedInputStream bis = new BufferedInputStream(ctx
						.getResources().getAssets().open("client/" + path));
				BufferedOutputStream bos = new BufferedOutputStream(
						new FileOutputStream(file));
				int bytes = 0;
				while ((bytes = bis.read(buffer)) > 0) {
					bos.write(buffer, 0, bytes);
				}
				bis.close();
				bos.close();
			}
			this.db = new DBHelper(ctx, file.getAbsolutePath(), 1) {

				@Override
				public void migrate(SQLiteDatabase db, int version) {
					// TODO Auto-generated method stub

				}
			};
			if (!db.open()) {
				db = null;
				return false;
			}
			return true;
		} catch (Exception e) {
			e.printStackTrace();
		}
		return false;
	}

}
