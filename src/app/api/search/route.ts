import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
        return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    try {
        // Fetch YouTube search page with improved headers to avoid consent redirection loops
        const response = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAQ%253D%253D`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'Referer': 'https://www.youtube.com/',
                'Cookie': 'CONSENT=YES+cb.20230531-17-p0.en+FX+917; PREF=hl=en&gl=US; VISITOR_INFO1_LIVE=f6_Xp7_Xp;'
            },
            redirect: 'follow'
        });
        const html = await response.text();

        // Extract ytInitialData more robustly without using /s flag
        const regex = /var ytInitialData = (\{[\s\S]*?\});/;
        const match = html.match(regex);

        if (!match) {
            console.log("[Search API] No ytInitialData found in HTML");
            // Fallback to suggestions
            const suggestResp = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`);
            const suggestData = await suggestResp.json();
            const suggestions = suggestData[1] || [];
            return NextResponse.json(suggestions.map((s: string) => ({ title: s, isSuggestion: true })));
        }

        let data;
        try {
            data = JSON.parse(match[1]);
        } catch (e) {
            console.error("[Search API] JSON Parse Error");
            return NextResponse.json({ error: 'Data parse error' }, { status: 500 });
        }

        const videos: any[] = [];

        // Traverse through potential contents paths
        const sectionList = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer;
        const contents = sectionList?.contents?.find((c: any) => c.itemSectionRenderer)?.itemSectionRenderer?.contents;

        if (contents) {
            contents.forEach((item: any) => {
                if (item.videoRenderer) {
                    const v = item.videoRenderer;

                    // Safely extract thumbnail
                    let thumbnail = "";
                    if (v.thumbnail?.thumbnails?.length > 0) {
                        thumbnail = v.thumbnail.thumbnails[v.thumbnail.thumbnails.length - 1].url;
                    }

                    videos.push({
                        id: v.videoId,
                        title: v.title?.runs?.[0]?.text || "Untitled",
                        thumbnail: thumbnail,
                        duration: v.lengthText?.simpleText || v.lengthText?.accessibility?.accessibilityData?.label || "",
                        views: v.shortViewCountText?.simpleText || "",
                        author: v.ownerText?.runs?.[0]?.text || "",
                        uploadDate: v.publishedTimeText?.simpleText || ""
                    });
                }
            });
        }

        return NextResponse.json(videos.slice(0, 10));
    } catch (err) {
        console.error("Search API Error:", err);
        return NextResponse.json({ error: 'Failed to search YouTube' }, { status: 500 });
    }
}
