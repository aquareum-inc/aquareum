// The geometry behind the agent's thinking orb: dotted 3D figures, one per kind of work. A Kotlin port of the
// six modes this app uses from "thinking orbs" by Jakub Antalik (MIT, see LICENSE), transcribed from the
// SwiftUI port vendored at apps/ios/Livepeer/Vendor/ThinkingOrbs, which was itself transcribed from the npm
// package the web uses. Every formula and constant matches; doubles throughout, as in the originals.

package org.livepeer.app.design.orb

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.acos
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.exp
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/** The animations this app shows, named as the library names them. */
enum class OrbState { Working, Searching, Solving, Weaving, Composing, Breathing }

/** One mark to draw. `white` is ink: 0 is the darkest ink on paper, mirrored on the dark theme. */
class Dot(val x: Double, val y: Double, val z: Double, var r: Double, val white: Double, val a: Double = 1.0)

/** The orb at one instant, at the library's 20-point design, with its speed. */
internal class OrbPreset(val speed: Double, private val opts: Map<String, Double>, val draw: (Double, Map<String, Double>) -> List<Dot>) {
    fun frame(t: Double): List<Dot> = draw(t, opts)
}

/** The 20-point tuning for each state: base profile, scaled by the preset's count and size, plus its extras. */
internal fun preset(state: OrbState): OrbPreset = presets.getOrPut(state) {
    when (state) {
        OrbState.Working -> resolve(mapOf("orbitN" to 12.0, "ghostN" to 40.0, "ghostR" to 0.9, "ghostA" to 0.5, "particles" to 3.0, "partR" to 1.2, "partRDepth" to 1.6, "rsPow" to 0.6, "rMin" to 0.3), 3.9, 0.238, 2.4, emptyMap(), ::frameOrbits)
        OrbState.Searching -> resolve(mapOf("latRings" to 17.0, "lonDensity" to 44.0, "rBase" to 0.6, "rDepth" to 1.7, "rBoost" to 1.0, "inkFar" to 0.62, "inkSpan" to 0.54, "rsPow" to 0.6, "rMin" to 0.3), 2.665, 0.105, 1.75, mapOf("scanMul" to 4.335, "dimBase" to 0.45), ::frameGlobe)
        OrbState.Solving -> resolve(mapOf("latRings" to 15.0, "lonDensity" to 40.0, "moveCount" to 14.0, "rBase" to 0.6, "rDepth" to 1.7, "rActive" to 0.3, "inkFar" to 0.62, "inkSpan" to 0.54, "rsPow" to 0.6, "rMin" to 0.3), 1.95, 0.088, 1.9, emptyMap(), ::frameRubik)
        OrbState.Weaving -> resolve(mapOf("strandN" to 52.0, "turns" to 3.0, "ghostN" to 150.0, "rBase" to 1.2, "rDepth" to 1.8, "rsPow" to 0.6, "rMin" to 0.3), 2.75, 0.1125, 1.36, emptyMap(), ::frameBraid)
        OrbState.Composing -> resolve(mapOf("lanes" to 5.0, "segs" to 88.0, "ghostN" to 150.0, "rBase" to 1.1, "rDepth" to 1.7, "rsPow" to 0.6, "rMin" to 0.3), 3.12, 0.051, 1.073, mapOf("spin" to 0.0, "bandMul" to 4.94, "wobMul" to 1.0), ::frameRibbon)
        OrbState.Breathing -> resolve(mapOf("lanes" to 5.0, "segs" to 88.0, "ghostN" to 0.0, "faceOn" to 1.0, "rBase" to 1.1, "rDepth" to 1.7, "rsPow" to 0.6, "rMin" to 0.3), 3.78, 0.028, 1.622, mapOf("spin" to 0.0, "bandMul" to 3.968, "wobMul" to 0.565), ::frameRibbon)
    }
}

/** The instant shown with animations off, the same as the library's. */
internal const val REDUCED_MOTION_T = 0.6
internal const val ORB_SIZE = 20.0

private val presets = mutableMapOf<OrbState, OrbPreset>()
private val COUNT_PAIRS = listOf("latRings" to "lonDensity", "lanes" to "segs")
private val COUNT_KEYS = listOf("orbitN", "ghostN", "strandN")
private val RADIUS_KEYS = listOf("rBase", "rDepth", "rActive", "ghostR", "partR", "partRDepth")

private fun resolve(base: Map<String, Double>, speed: Double, count: Double, size: Double, extra: Map<String, Double>, mode: (Double, Double, Map<String, Double>) -> List<Dot>): OrbPreset {
    val opts = base.toMutableMap()
    if (count != 1.0) {
        val done = mutableSetOf<String>()
        val rt = sqrt(count)
        for ((a, b) in COUNT_PAIRS) {
            val va = opts[a] ?: continue
            val vb = opts[b] ?: continue
            opts[a] = max(2.0, roundHalfAway(va * rt))
            opts[b] = max(2.0, roundHalfAway(vb * rt))
            done += a
            done += b
        }
        // 0 means the mode opted out of that layer; scaling must not bring it back as one stray dot
        for (k in COUNT_KEYS) { val v = opts[k]; if (v != null && v != 0.0 && k !in done) opts[k] = max(1.0, roundHalfAway(v * count)) }
    }
    if (size != 1.0) for (k in RADIUS_KEYS) opts[k]?.let { opts[k] = it * size }
    opts.putAll(extra)
    return OrbPreset(speed, opts) { t, o -> mode(ORB_SIZE, t, o) }
}

private fun roundHalfAway(x: Double): Double = if (x >= 0) floor(x + 0.5) else -floor(-x + 0.5)
private fun Map<String, Double>.o(key: String, default: Double) = this[key] ?: default

// --- shared primitives --------------------------------------------------------------------------

internal fun hashD(a: Double, b: Double): Double { val h = sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - floor(h) }

private fun fibDir(i: Int, n: Int): Triple<Double, Double, Double> {
    val golden = PI * (3 - sqrt(5.0))
    val y = 1 - (2 * (i + 0.5)) / n
    val rad = sqrt(1 - y * y)
    val a = i * golden
    return Triple(rad * cos(a), y, rad * sin(a))
}

private fun angleDelta(a: Double, b: Double) = atan2(sin(a - b), cos(a - b))
private fun frac(x: Double) = x - floor(x)
private fun radiusScale(size: Double, p: Double) = (size / 300).pow(p)

/** Spin, tilt and orthographic projection. */
private class Projector(yaw: Double, tilt: Double, private val cx: Double, private val cy: Double, private val scale: Double) {
    private val st = sin(tilt); private val ct = cos(tilt); private val sy = sin(yaw); private val cyw = cos(yaw)
    operator fun invoke(x: Double, y: Double, z: Double): Triple<Double, Double, Double> {
        val x1 = x * cyw + z * sy
        val z1 = -x * sy + z * cyw
        val y1 = y * ct - z1 * st
        val z2 = y * st + z1 * ct
        return Triple(cx + x1 * scale, cy - y1 * scale, z2)
    }
}

/** Drops invisible marks, clamps radii to the mode's floor and sorts far to near (stable, as on the web). */
private fun finalizeFrame(dots: List<Dot>, rMin: Double): List<Dot> =
    dots.filter { it.a >= 0.02 }.onEach { it.r = max(rMin, it.r) }.sortedBy { it.z }

// --- orbits: particles on tilted orbits (working) -----------------------------------------------

private fun frameOrbits(size: Double, t: Double, o: Map<String, Double>): List<Dot> {
    val cx = size / 2; val cy = size / 2; val radius = (size / 2) * 0.82
    val pt = Projector(t * 0.12, 0.3, cx, cy, 1.0)
    val rs = radiusScale(size, o.o("rsPow", 0.6))
    val dots = ArrayList<Dot>()
    val orbitN = o.o("orbitN", 12.0).toInt(); val ghostN = o.o("ghostN", 40.0).toInt(); val particles = o.o("particles", 3.0).toInt()
    for (orb in 0 until orbitN) {
        val h1 = hashD(orb.toDouble(), 1.7); val h2 = hashD(orb.toDouble(), 5.2); val h3 = hashD(orb.toDouble(), 8.9)
        val ro = radius * (0.45 + 0.52 * h1)
        val th = h1 * 2 * PI
        val phi = acos(2 * h2 - 1)
        val nx = sin(phi) * cos(th); val ny = cos(phi); val nz = sin(phi) * sin(th)
        var ux = -ny; var uy = nx; val uz = 0.0
        val ul = max(1e-6, sqrt(ux * ux + uy * uy))
        ux /= ul; uy /= ul
        val vx = ny * uz - nz * uy; val vy = nz * ux - nx * uz; val vz = nx * uy - ny * ux
        val speed = (0.25 + 0.55 * h3) * (if (h3 > 0.5) 1 else -1)
        for (k in 0 until ghostN) {
            val a = (k.toDouble() / ghostN) * 2 * PI
            val (px, py, z) = pt((ux * cos(a) + vx * sin(a)) * ro, (uy * cos(a) + vy * sin(a)) * ro, (uz * cos(a) + vz * sin(a)) * ro)
            val depth = (z / ro + 1) / 2
            dots += Dot(px, py, z, o.o("ghostR", 0.9) * rs, 0.72, o.o("ghostA", 0.5) * (0.4 + 0.6 * depth))
        }
        for (m in 0 until particles) {
            val a = t * speed + (m.toDouble() / particles) * 2 * PI + h2 * 6
            val (px, py, z) = pt((ux * cos(a) + vx * sin(a)) * ro, (uy * cos(a) + vy * sin(a)) * ro, (uz * cos(a) + vz * sin(a)) * ro)
            val depth = (z / ro + 1) / 2
            dots += Dot(px, py, z, (o.o("partR", 1.2) + o.o("partRDepth", 1.6) * depth) * rs, 0.3 - 0.22 * depth)
        }
    }
    return finalizeFrame(dots, o.o("rMin", 0.3))
}

// --- globe: a scan meridian sweeps a dotted globe (searching) -----------------------------------

private fun frameGlobe(size: Double, t: Double, o: Map<String, Double>): List<Dot> {
    val spin = 0.5
    val radius = (size / 2) * 0.82
    val pt = Projector(t * spin, 0.4 + 0.06 * sin(t * 0.35), size / 2, size / 2, radius)
    val scan = t * (spin + (1.7 - spin) * o.o("scanMul", 1.0))
    val rs = radiusScale(size, o.o("rsPow", 0.6))
    val dimBase = o.o("dimBase", 1.0)
    val dots = ArrayList<Dot>()
    val latRings = o.o("latRings", 17.0).toInt(); val lonDensity = o.o("lonDensity", 44.0)
    for (li in 0..latRings) {
        val lat = -PI / 2 + (li.toDouble() / latRings) * PI
        val cosLat = cos(lat); val sinLat = sin(lat)
        val lonCount = max(1, roundHalfAway(abs(cosLat) * lonDensity).toInt())
        for (lj in 0 until lonCount) {
            val lon = (lj.toDouble() / lonCount) * 2 * PI
            val (px, py, z) = pt(cosLat * cos(lon), sinLat, cosLat * sin(lon))
            val depth = (z + 1) / 2
            val d = angleDelta(lon + t * spin, scan)
            val boost = exp(-(d * d) / 0.18) * max(0.0, z)
            dots += Dot(px, py, z, (o.o("rBase", 0.6) + o.o("rDepth", 1.7) * depth + o.o("rBoost", 1.0) * boost) * rs,
                o.o("inkFar", 0.62) - o.o("inkSpan", 0.54) * depth, dimBase + (1 - dimBase) * min(1.0, boost))
        }
    }
    return finalizeFrame(dots, o.o("rMin", 0.3))
}

// --- rubik: bands twist in quarter turns, scramble then solve (solving) -------------------------

private class Move(val axis: Int, val lo: Double, val hi: Double, val ang: Double)

private fun frameRubik(size: Double, t: Double, o: Map<String, Double>): List<Dot> {
    val radius = (size / 2) * 0.82
    val pt = Projector(t * 0.55, 0.35 + 0.1 * sin(t * 0.9), size / 2, size / 2, radius)
    val rs = radiusScale(size, o.o("rsPow", 0.6))
    val count = o.o("moveCount", 14.0).toInt()
    val moves = (0 until count).map { i ->
        val axis = min(2, floor(hashD(i.toDouble(), 2.3) * 3).toInt())
        val lo = -1.0 + 0.5 * min(3, floor(hashD(i.toDouble(), 5.9) * 4).toInt())
        Move(axis, lo, lo + 0.5, (if (hashD(i.toDouble(), 7.7) < 0.5) 1 else -1) * PI / 2)
    }
    // the solver's heartbeat: eased moves scramble, then replay in reverse so it clicks back to solved
    val slotDur = 0.42; val rest = 1.2
    val cycle = 2 * count * slotDur + rest
    val tc = t % cycle
    val amount = DoubleArray(count)
    var active = -1
    if (tc < 2 * count * slotDur) {
        val slot = floor(tc / slotDur).toInt()
        val p = (tc - slot * slotDur) / slotDur
        val ep = 1 - (1 - min(1.0, p / 0.7)).pow(3)
        if (slot < count) { for (i in 0 until slot) amount[i] = 1.0; amount[slot] = ep; active = slot }
        else { val u = 2 * count - 1 - slot; for (i in 0 until u) amount[i] = 1.0; amount[u] = 1 - ep; active = u }
    }
    val dots = ArrayList<Dot>()
    val latRings = o.o("latRings", 15.0).toInt(); val lonDensity = o.o("lonDensity", 40.0)
    for (li in 0..latRings) {
        val lat = -PI / 2 + (li.toDouble() / latRings) * PI
        val cosLat = cos(lat); val sinLat = sin(lat)
        val lonCount = max(1, roundHalfAway(abs(cosLat) * lonDensity).toInt())
        for (lj in 0 until lonCount) {
            val lon = (lj.toDouble() / lonCount) * 2 * PI
            var x = cosLat * cos(lon); var y = sinLat; var z = cosLat * sin(lon)
            var inActive = false
            for (i in moves.indices) {
                if (amount[i] <= 0) continue
                val mv = moves[i]
                val coord = when (mv.axis) { 0 -> x; 1 -> y; else -> z }
                if (coord < mv.lo || coord >= mv.hi) continue
                if (i == active) inActive = true
                val a = mv.ang * amount[i]; val ca = cos(a); val sa = sin(a)
                when (mv.axis) {
                    0 -> { val y2 = y * ca - z * sa; z = y * sa + z * ca; y = y2 }
                    1 -> { val x2 = x * ca + z * sa; z = -x * sa + z * ca; x = x2 }
                    else -> { val x2 = x * ca - y * sa; y = x * sa + y * ca; x = x2 }
                }
            }
            val (px, py, zr) = pt(x, y, z)
            val depth = (zr + 1) / 2
            dots += Dot(px, py, zr, (o.o("rBase", 0.6) + o.o("rDepth", 1.7) * depth + (if (inActive) o.o("rActive", 0.3) else 0.0)) * rs,
                o.o("inkFar", 0.62) - o.o("inkSpan", 0.54) * depth - (if (inActive) 0.14 else 0.0))
        }
    }
    return finalizeFrame(dots, o.o("rMin", 0.3))
}

// --- braid: three strands plait around the sphere (weaving) -------------------------------------

private fun ghostSphere(pt: Projector, radius: Double, n: Int, rs: Double, into: MutableList<Dot>) {
    for (i in 0 until n) {
        val (dx, dy, dz) = fibDir(i, n)
        val (px, py, z) = pt(dx * radius, dy * radius, dz * radius)
        val depth = (z / radius + 1) / 2
        into += Dot(px, py, z, 0.8 * rs, 0.78, 0.1 + 0.22 * depth)
    }
}

private fun frameBraid(size: Double, t: Double, o: Map<String, Double>): List<Dot> {
    val radius = (size / 2) * 0.76
    val pt = Projector(t * 0.4, 0.3, size / 2, size / 2, 1.0)
    val rs = radiusScale(size, o.o("rsPow", 0.6))
    val dots = ArrayList<Dot>()
    ghostSphere(pt, radius, o.o("ghostN", 150.0).toInt(), rs, dots)
    val strandN = o.o("strandN", 52.0).toInt(); val turns = o.o("turns", 3.0)
    for (s in 0 until 3) {
        val phase = (s / 3.0) * 2 * PI
        for (i in 0 until strandN) {
            val u = (frac(i.toDouble() / strandN + t * 0.045) * 2 - 1) * 0.96
            val surf = sqrt(max(0.0, 1 - u * u))
            val endFade = min(1.0, (1 - abs(u)) / 0.1)
            val a = u * PI * turns + phase
            val weave = 1 + 0.075 * sin(u * PI * turns * 2 + phase * 2 + t * 0.8)
            val rr = surf * radius * weave
            val (px, py, zr) = pt(cos(a) * rr, u * radius * weave, sin(a) * rr)
            val depth = (zr / radius + 1) / 2
            dots += Dot(px, py, zr, (o.o("rBase", 1.2) + o.o("rDepth", 1.8) * depth) * rs, 0.55 - 0.45 * depth, endFade * (0.45 + 0.55 * depth))
        }
    }
    return finalizeFrame(dots, o.o("rMin", 0.3))
}

// --- ribbon: an undulating sash (composing); face-on, a ring slowly morphing (breathing) ----------

private fun frameRibbon(size: Double, t: Double, o: Map<String, Double>): List<Dot> {
    val radius = (size / 2) * 0.78
    val spin = o.o("spin", 1.0)
    val camTilt = 0.3
    val faceOn = o.o("faceOn", 0.0) != 0.0
    val pt = Projector(t * 0.1 * spin, camTilt, size / 2, size / 2, 1.0)
    val rs = radiusScale(size, o.o("rsPow", 0.6))
    val dots = ArrayList<Dot>()
    val ghostN = o.o("ghostN", 150.0).toInt()
    if (ghostN > 0) ghostSphere(pt, radius, ghostN, rs, dots)

    val ya = t * 0.24 * spin
    val ta = if (faceOn) -camTilt else 0.55 + 0.3 * sin(t * 0.18) * spin
    val ux = cos(ya); val uy = 0.0; val uz = sin(ya)
    val vx = -uz * sin(ta); val vy = cos(ta); val vz = ux * sin(ta)
    val nx = uy * vz - uz * vy; val ny = uz * vx - ux * vz; val nz = ux * vy - uy * vx
    val wobMul = o.o("wobMul", 1.0)
    val baseR = if (faceOn) radius / (1 + 0.85 * 0.23 * wobMul) else radius
    val segs = o.o("segs", 88.0).toInt()
    val lanes = max(1, roundHalfAway(o.o("lanes", 5.0) * o.o("bandMul", 1.0)).toInt())
    for (w in 0 until lanes) {
        val laneOff = (w - (lanes - 1) / 2.0) * 0.075
        val edge = abs(w - (lanes - 1) / 2.0) / max(1.0, (lanes - 1) / 2.0)
        for (k in 0 until segs) {
            val a = (k.toDouble() / segs) * 2 * PI
            val wob = (0.16 * sin(a * 3 - t * 1.7 + w * 0.22) + 0.07 * sin(a * 5 + t * 1.1)) * wobMul
            val radial = if (faceOn) 1 + wob else 1.0
            val off = if (faceOn) laneOff else laneOff + wob
            val x = ux * cos(a) + vx * sin(a) + nx * off
            val y = uy * cos(a) + vy * sin(a) + ny * off
            val z = uz * cos(a) + vz * sin(a) + nz * off
            val l = sqrt(x * x + y * y + z * z)
            val rr = baseR * radial
            val (px, py, zr) = pt((x / l) * rr, (y / l) * rr, (z / l) * rr)
            val depth = (zr / radius + 1) / 2
            dots += Dot(px, py, zr, (o.o("rBase", 1.1) + o.o("rDepth", 1.7) * depth) * (1 - 0.25 * edge) * rs, 0.52 - 0.44 * depth + 0.18 * edge, 0.4 + 0.6 * depth)
        }
    }
    return finalizeFrame(dots, o.o("rMin", 0.3))
}
