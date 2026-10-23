using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using VNotch.Controls.Agents;
using VNotch.Services.Agents;
using Xunit;

namespace VNotch.Tests;
public sealed class AgentDashboardTests
{
    private static T Part<T>(AgentDashboard view, string name) => (T)view.FindName(name);
    private static AgentSnapshot Sample(DateTimeOffset now) => new([
        new("Codex", [new("one",now,"fixture",123456,1234,100000)], [new("Codex","Build local transfer","V-Notch","Recent",now)],
            new("Live account",[new("5 hours",27,now.AddHours(2).AddMinutes(16),now,"Account"),new("Weekly",54,now.AddDays(3).AddHours(4),now,"Account")],now),true),
        new("Claude Code", [new("two",now,"fixture",60000,8000,40000)], [new("Claude Code","Review notch layout","V-Notch","Working",now)],
            new("Live account",[new("5 hours",38,now.AddHours(1).AddMinutes(42),now,"Account"),new("Weekly",19,now.AddDays(4).AddHours(8),now,"Account")],now),false)
    ],now);
    [Fact]
    public void MissingAndExpiredQuotasRenderExplicitlyWithoutZeroPercentClaims() => SharedStaTestRunner.RunAsync(() =>
    {
        using var view = new AgentDashboard(); var now = DateTimeOffset.Now;
        view.Present(new([new("Codex",[],[],new("CLI not found",[],now),false),new("Claude Code",[],[],new("Not signed in",[],now),false)],now));
        Assert.Equal(Visibility.Visible, Part<TextBlock>(view,"EmptyActivity").Visibility);
        Assert.Equal(2, Part<ItemsControl>(view,"Providers").Items.Count);
        Assert.Contains("Reset due",AgentDashboard.ResetText(new("5 hours",10,now.AddSeconds(-1),now,"Account"),now));
        Assert.Contains("snapshot",AgentDashboard.ResetText(new("5 hours",10,now.AddHours(1),now.AddMinutes(-8),"Log snapshot"),now));
        return Task.CompletedTask;
    });
    [Theory]
    [InlineData(622,496)][InlineData(382,300)]
    public void NativeCardsFitNarrowAndFullNotchSizes(double width,double height) => SharedStaTestRunner.RunAsync(() =>
    {
        using var view = new AgentDashboard { FontFamily = new FontFamily($"pack://application:,,,/{typeof(AgentDashboard).Assembly.GetName().Name};component/Fonts/#SF Pro Display, Segoe UI") };
        view.Present(Sample(DateTimeOffset.Now)); view.Measure(new Size(width,height)); view.Arrange(new Rect(0,0,width,height)); view.UpdateLayout();
        foreach (string name in new[]{"RefreshLimits","Today","Week","Month","Providers","AgentScroll"})
        {
            var element = Part<FrameworkElement>(view,name); var bounds = element.TransformToAncestor(view).TransformBounds(new Rect(element.RenderSize));
            Assert.True(bounds.Left>=0 && bounds.Right<=width+0.5 && bounds.Top>=0 && (name=="Providers" || bounds.Bottom<=height+0.5),name+" must fit the notch viewport");
        }
        Assert.Equal("1 working",Part<TextBlock>(view,"ActivityCount").Text);
        Assert.True(Part<ScrollViewer>(view,"AgentScroll").ScrollableWidth<1);
        if(height<400) Assert.True(Part<ScrollViewer>(view,"AgentScroll").ScrollableHeight>0);
        if(width>600)
        {
            var visual = new DrawingVisual(); using(var context=visual.RenderOpen()) { context.DrawRectangle(Brushes.Black,null,new Rect(0,0,width+48,height+64)); context.DrawRectangle(new VisualBrush(view),null,new Rect(24,44,width,height)); }
            var image = new RenderTargetBitmap((int)width+48,(int)height+64,96,96,PixelFormats.Pbgra32); image.Render(visual);
            string folder=Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"../../../../../.test-output"));Directory.CreateDirectory(folder);
            var encoder=new PngBitmapEncoder();encoder.Frames.Add(BitmapFrame.Create(image));using var file=File.Create(Path.Combine(folder,"agent-dashboard.png"));encoder.Save(file);
        }
        return Task.CompletedTask;
    });
}
