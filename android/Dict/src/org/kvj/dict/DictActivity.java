package org.kvj.dict;

import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;

import com.phonegap.DroidGap;

public class DictActivity extends DroidGap {
	/** Called when the activity is first created. */
	@Override
	public void onCreate(Bundle savedInstanceState) {
		setRequestedOrientation(getResources().getConfiguration().orientation);
		super.setIntegerProperty("backgroundColor", Color.BLACK);
		super.setBooleanProperty("keepRunning", true);
		super.onCreate(savedInstanceState);
		super.init();
		appView.setVerticalScrollBarEnabled(true);
		appView.setScrollBarStyle(WebView.SCROLLBARS_INSIDE_OVERLAY);
		appView.setScrollbarFadingEnabled(true);
		super.loadUrl("file:///android_asset/client/dict.html");
	}
}