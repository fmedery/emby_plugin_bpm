using System;
using System.IO;
using System.Text;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Controller.Plugins;
using MediaBrowser.Model.Logging;

namespace Emby.Plugin.BpmTempo
{
    public class ServerEntryPoint : IServerEntryPoint
    {
        private readonly IApplicationPaths _appPaths;
        private readonly ILogger _logger;
        private const string ScriptMarker = "<!-- EMBY_BPM_TEMPO_INJECTED -->";

        public ServerEntryPoint(IApplicationPaths appPaths, ILogManager logManager)
        {
            _appPaths = appPaths;
            _logger = logManager.GetLogger("BpmTempoController");
        }

        public void Run()
        {
            _logger.Info("BPM & Tempo Controller Plugin initialized.");
            TryInjectWebClient();
        }

        private void TryInjectWebClient()
        {
            try
            {
                var candidates = new[]
                {
                    Path.Combine(_appPaths.ProgramSystemPath ?? string.Empty, "dashboard-ui", "index.html"),
                    Path.Combine(_appPaths.ProgramDataPath ?? string.Empty, "dashboard-ui", "index.html"),
                    "/system/dashboard-ui/index.html"
                };

                foreach (var htmlPath in candidates)
                {
                    if (!string.IsNullOrEmpty(htmlPath) && File.Exists(htmlPath))
                    {
                        InjectIntoIndexHtml(htmlPath);
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.Warn("Notice: Automatic index.html injection skipped ({0}). Client assets remain available via API.", ex.Message);
            }
        }

        private void InjectIntoIndexHtml(string htmlPath)
        {
            try
            {
                var content = File.ReadAllText(htmlPath, Encoding.UTF8);
                if (content.Contains(ScriptMarker))
                {
                    _logger.Info("BPM & Tempo Controller script tag already present in {0}", htmlPath);
                    return;
                }

                var tags = $"{ScriptMarker}\n" +
                           $"<link rel=\"stylesheet\" href=\"/Plugins/BpmTempo/style.css\">\n" +
                           $"<script type=\"text/javascript\" src=\"/Plugins/BpmTempo/script.js\" defer></script>\n";

                if (content.Contains("</body>"))
                {
                    var updated = content.Replace("</body>", tags + "</body>");
                    File.WriteAllText(htmlPath, updated, Encoding.UTF8);
                    _logger.Info("Successfully injected BPM & Tempo Controller into {0}", htmlPath);
                }
            }
            catch (Exception ex)
            {
                _logger.Warn("Could not write to index.html (file may be read-only): {0}", ex.Message);
            }
        }

        public void Dispose()
        {
            _logger.Info("BPM & Tempo Controller Plugin disposed.");
        }
    }
}
