using System;
using System.IO;
using System.Reflection;
using System.Text;
using MediaBrowser.Controller.Library;
using MediaBrowser.Model.Services;

namespace Emby.Plugin.BpmTempo.Api
{
    [Route("/Plugins/BpmTempo/script.js", "GET", Summary = "Gets the client BPM player script")]
    public class GetBpmScript : IReturn<string>
    {
    }

    [Route("/Plugins/BpmTempo/style.css", "GET", Summary = "Gets the client BPM player stylesheet")]
    public class GetBpmStyle : IReturn<string>
    {
    }

    [Route("/Plugins/BpmTempo/TrackBpm/{ItemId}", "GET", Summary = "Gets BPM and audio metadata for a music track")]
    public class GetTrackBpm : IReturn<TrackBpmResponse>
    {
        public string ItemId { get; set; }
    }

    public class TrackBpmResponse
    {
        public string ItemId { get; set; }
        public string Title { get; set; }
        public float? Bpm { get; set; }
        public bool HasBpm { get; set; }
    }

    public class BpmApiService : IService
    {
        private readonly ILibraryManager _libraryManager;

        public BpmApiService(ILibraryManager libraryManager)
        {
            _libraryManager = libraryManager;
        }

        public object Get(GetTrackBpm request)
        {
            var response = new TrackBpmResponse
            {
                ItemId = request.ItemId,
                HasBpm = false
            };

            if (Guid.TryParse(request.ItemId, out var id))
            {
                var item = _libraryManager.GetItemById(id);
                if (item != null)
                {
                    response.Title = item.Name;
                    
                    if (item.Tags != null)
                    {
                        foreach (var tag in item.Tags)
                        {
                            if (TryParseBpmFromText(tag, out var bpmVal))
                            {
                                response.Bpm = bpmVal;
                                response.HasBpm = true;
                                break;
                            }
                        }
                    }

                    if (!response.HasBpm && !string.IsNullOrEmpty(item.Overview))
                    {
                        if (TryParseBpmFromText(item.Overview, out var bpmVal))
                        {
                            response.Bpm = bpmVal;
                            response.HasBpm = true;
                        }
                    }
                }
            }

            return response;
        }

        public object Get(GetBpmScript request)
        {
            return ReadEmbeddedString("Emby.Plugin.BpmTempo.Web.bpm-player.js");
        }

        public object Get(GetBpmStyle request)
        {
            return ReadEmbeddedString("Emby.Plugin.BpmTempo.Web.bpm-player.css");
        }

        private static string ReadEmbeddedString(string resourceName)
        {
            var assembly = Assembly.GetExecutingAssembly();
            using (var stream = assembly.GetManifestResourceStream(resourceName))
            {
                if (stream == null) return string.Empty;
                using (var reader = new StreamReader(stream, Encoding.UTF8))
                {
                    return reader.ReadToEnd();
                }
            }
        }

        private static bool TryParseBpmFromText(string text, out float bpm)
        {
            bpm = 0f;
            if (string.IsNullOrWhiteSpace(text)) return false;

            var lower = text.ToLowerInvariant();
            if (lower.Contains("bpm"))
            {
                var parts = lower.Split(new[] { ' ', ':', '=', ';', ',', '|', '\n', '\r' }, StringSplitOptions.RemoveEmptyEntries);
                for (int i = 0; i < parts.Length; i++)
                {
                    if (parts[i] == "bpm" && i > 0 && float.TryParse(parts[i - 1], out var valBefore) && valBefore >= 30 && valBefore <= 300)
                    {
                        bpm = valBefore;
                        return true;
                    }
                    if (parts[i] == "bpm" && i + 1 < parts.Length && float.TryParse(parts[i + 1], out var valAfter) && valAfter >= 30 && valAfter <= 300)
                    {
                        bpm = valAfter;
                        return true;
                    }
                    if (parts[i].EndsWith("bpm"))
                    {
                        var numStr = parts[i].Substring(0, parts[i].Length - 3);
                        if (float.TryParse(numStr, out var v) && v >= 30 && v <= 300)
                        {
                            bpm = v;
                            return true;
                        }
                    }
                }
            }
            return false;
        }
    }
}
