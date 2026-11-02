package lab.stack.companion

import android.content.Context
import android.graphics.Color
import android.graphics.PixelFormat
import android.hardware.input.InputManager
import android.os.Build
import android.provider.Settings
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.TextView

/** Native integration component, not a standalone application. Call only on the main thread.
 * Own exactly one overlay; controls belong to the activity/notification, never this window.
 */
class TouchThroughOverlay(private val context: Context) {
    private val manager = context.getSystemService(WindowManager::class.java)
    private var view: TextView? = null

    fun show(summary: String) {
        check(Build.VERSION.SDK_INT >= 26) { "Android 8 이상 필요" }
        check(Settings.canDrawOverlays(context)) { "다른 앱 위 표시 권한 필요" }
        view?.let { it.text = summary.take(240); return }
        val maximum = if (Build.VERSION.SDK_INT >= 31) {
            context.getSystemService(InputManager::class.java).maximumObscuringOpacityForTouch
        } else 0.8f
        // Window alpha is required for Android 12+ touch-through security checks.
        val opacity = minOf(0.6f, maximum * 0.75f)
        check(opacity > 0f) { "터치 통과 가능한 투명도를 확보하지 못했습니다." }
        val label = TextView(context).apply {
            text = summary.take(240)
            textSize = 12f
            setTextColor(Color.WHITE)
            setBackgroundColor(Color.rgb(15, 23, 38))
            setPadding(12, 8, 12, 8)
            isClickable = false
            isLongClickable = false
            isFocusable = false
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }
        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            alpha = opacity
            gravity = Gravity.TOP or Gravity.END
            x = 12
            y = 80
        }
        manager.addView(label, params)
        view = label
    }

    fun hide() {
        val label = view ?: return
        view = null
        manager.removeViewImmediate(label)
    }
}
