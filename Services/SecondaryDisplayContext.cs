namespace VNotch.Services;

/// <summary>Optional construction context, deliberately not registered as a root DI service.</summary>
public sealed class SecondaryDisplayContext
{
    internal MainWindow Owner { get; }
    internal SecondaryDisplayContext(MainWindow owner) => Owner = owner;
}
