package io.ionic.starter;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AlarmPlugin")
public class AlarmPlugin extends Plugin {

    public void startAlarm(PluginCall call) {
        Intent intent = new Intent(getContext(), AlarmService.class);
        getContext().startForegroundService(intent);
        call.resolve();
    }

    public void stopAlarm(PluginCall call) {
        Intent intent = new Intent(getContext(), AlarmService.class);
        getContext().stopService(intent);
        call.resolve();
    }
}
