// New component only. No application assembly, startup, native Show or user input.
using System.Windows.Threading;

namespace VNotch.Tests;

internal static class SharedStaTestRunner
{
    public static void RunAsync(Func<Task> action)
    {
        var completed = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread = new Thread(() =>
        {
            var dispatcher = Dispatcher.CurrentDispatcher;
            dispatcher.BeginInvoke(async () =>
            {
                try { await action(); completed.TrySetResult(); }
                catch (Exception ex) { completed.TrySetException(ex); }
                finally { dispatcher.BeginInvokeShutdown(DispatcherPriority.Background); }
            });
            Dispatcher.Run();
        }) { IsBackground = true };
        thread.SetApartmentState(ApartmentState.STA); thread.Start();
        completed.Task.WaitAsync(TimeSpan.FromSeconds(30)).GetAwaiter().GetResult();
    }
}
