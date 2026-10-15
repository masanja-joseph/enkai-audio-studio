package com.dubmix.studio.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val CharcoalBackground = Color(0xFF0E1013)
val SurfaceDark = Color(0xFF16191E)
val SurfaceBorder = Color(0xFF262B34)
val AccentBlue = Color(0xFF3B82F6)
val AccentGreen = Color(0xFF10B981)
val AccentAmber = Color(0xFFF59E0B)
val AccentRed = Color(0xFFEF4444)
val TextPrimary = Color(0xFFF1F3F5)
val TextSecondary = Color(0xFF9AA2B1)

private val DarkColorScheme = darkColorScheme(
    primary = AccentBlue,
    background = CharcoalBackground,
    surface = SurfaceDark,
    onPrimary = Color.White,
    onBackground = TextPrimary,
    onSurface = TextPrimary
)

@Composable
fun DubMixStudioTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography(),
        content = content
    )
}
