import java.util.Collection;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * =========================================================================
 * JsonUtil.java - Lightweight JSON Formatter & Parser
 * =========================================================================
 * 
 * EXPLANATION FOR TEACHER / EXAMINER:
 * -----------------------------------
 * This helper serializes Java Maps and Lists into standard JSON strings
 * to send to the browser frontend, and extracts simple key-values from
 * client HTTP POST request bodies without requiring heavy external libraries.
 */
public class JsonUtil {

    public static String toJson(Object obj) {
        if (obj == null) return "null";

        if (obj instanceof String) {
            return "\"" + escapeString((String) obj) + "\"";
        }
        if (obj instanceof Number || obj instanceof Boolean) {
            return obj.toString();
        }
        if (obj instanceof Map) {
            Map<?, ?> map = (Map<?, ?>) obj;
            StringBuilder sb = new StringBuilder("{");
            boolean first = true;
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                if (!first) sb.append(",");
                sb.append("\"").append(escapeString(String.valueOf(entry.getKey()))).append("\":");
                sb.append(toJson(entry.getValue()));
                first = false;
            }
            sb.append("}");
            return sb.toString();
        }
        if (obj instanceof Collection) {
            Collection<?> col = (Collection<?>) obj;
            StringBuilder sb = new StringBuilder("[");
            boolean first = true;
            for (Object item : col) {
                if (!first) sb.append(",");
                sb.append(toJson(item));
                first = false;
            }
            sb.append("]");
            return sb.toString();
        }
        return "\"" + escapeString(obj.toString()) + "\"";
    }

    public static String getString(String json, String key) {
        if (json == null) return null;
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*\"([^\"]*)\"");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            return matcher.group(1);
        }
        return null;
    }

    public static Integer getInt(String json, String key) {
        if (json == null) return null;
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*(\\d+)");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            try { return Integer.parseInt(matcher.group(1)); } catch (Exception ignored) {}
        }
        return null;
    }

    public static Double getDouble(String json, String key) {
        if (json == null) return null;
        Pattern pattern = Pattern.compile("\"" + Pattern.quote(key) + "\"\\s*:\\s*([0-9.]+)");
        Matcher matcher = pattern.matcher(json);
        if (matcher.find()) {
            try { return Double.parseDouble(matcher.group(1)); } catch (Exception ignored) {}
        }
        return null;
    }

    private static String escapeString(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\b", "\\b")
                .replace("\f", "\\f")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }
}
