package com.countdownzone.timesync

import com.countdownzone.api.*
import java.io.*
import javax.servlet.*
import javax.servlet.http.*
import kotlinx.serialization.*
import kotlinx.serialization.json.JSON
import kotlinx.serialization.Serializable

@Serializable
data class TimeData(val id: Int, val result: Long)

@Serializable
data class SyncData(val jsonrpc: String, val id: Int, val method: String)

/**
 * A timesync servlet, similar to the timesync library for nodejs.
 * That code can be found at https://github.com/enmasseio/timesync/blob/master/server/index.js
 */
class TimesyncServlet() : HttpServlet() {

	/**
	 * Responds to a get request, in accordance with the Servlet API.
	 * This is used only to serve static content, namely timesync.js and timesync.min.js.
	 * This may be modified in the future to serve more things, but that is unlikely given
	 * the purpose of this servlet.
	 */
	override fun doGet(req: HttpServletRequest, resp: HttpServletResponse) {
		val uri = req.getRequestURL()
		// ugly syntax :(
		var fileToServe: String = getServletContext().getRealPath(".")
		when {
			uri.endsWith("timesync.js") -> fileToServe += ("/timesync.js")
			uri.endsWith("timesync.min.js") -> fileToServe += ("/timesync.min.js")
			else -> {
				send404(resp)
				return
			}
		}
		serveFile(fileToServe, resp)
	}

	override fun doPost(req: HttpServletRequest, resp: HttpServletResponse) {
		val time: Long = System.currentTimeMillis()
		val bodyContent: SyncData = JSON.parse<SyncData>(req.getReader().use { it.readText() })
		val toSend = TimeData(bodyContent.id, time)
		val cout: PrintWriter = resp.getWriter()
		resp.setContentType("application/json")
		cout.println(JSON.stringify(toSend))
	}
}