// TraceNetDbContext.cs
// Entity Framework Core database context for the project

using Microsoft.EntityFrameworkCore;
using TraceNet.Models;

namespace TraceNet.Data
{
    /// <summary>
    /// Entity Framework Core database context for the project.
    /// Provides the data access layer for tracking network devices and cable connections.
    /// </summary>
    public class TraceNetDbContext : DbContext
    {
        /// <summary>
        /// Constructor: accepts database connection options and passes them to the base class.
        /// </summary>
        /// <param name="options">Database connection configuration options</param>
        public TraceNetDbContext(DbContextOptions<TraceNetDbContext> options)
            : base(options)
        {
        }

        /// <summary>
        /// DbSet for network devices (Device).
        /// Stores information about routers, switches, servers, and other network devices.
        /// </summary>
        public DbSet<Device> Devices => Set<Device>();

        /// <summary>
        /// DbSet for ports (Port).
        /// Stores information about network ports belonging to each device.
        /// </summary>
        public DbSet<Port> Ports => Set<Port>();

        /// <summary>
        /// DbSet for cables (Cable).
        /// Stores information about physical cables.
        /// </summary>
        public DbSet<Cable> Cables => Set<Cable>();

        /// <summary>
        /// DbSet for cable connections (CableConnection).
        /// Stores information about which ports are connected by a cable.
        /// </summary>
        public DbSet<CableConnection> CableConnections => Set<CableConnection>();

        /// <summary>
        /// DbSet for racks (Rack).
        /// Stores information about racks that contain devices.
        /// </summary>
        public DbSet<Rack> Racks => Set<Rack>();

        /// <summary>
        /// Configures relationships between models.
        /// Defines foreign key constraints and relationships between database tables.
        /// </summary>
        /// <param name="modelBuilder">ModelBuilder instance</param>
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Define one-to-many relationship between Device and Port
            modelBuilder.Entity<Device>()
                .HasMany(d => d.Ports)
                .WithOne(p => p.Device)
                .HasForeignKey(p => p.DeviceId)
                .OnDelete(DeleteBehavior.Cascade); // When a device is deleted, its ports are also deleted

            // Define one-to-one relationship between Cable and CableConnection
            // Each cable has exactly one connection record
            modelBuilder.Entity<Cable>()
                .HasOne(c => c.Connection)                    // Cable has one Connection
                .WithOne(cc => cc.Cable)                      // CableConnection has one Cable
                .HasForeignKey<CableConnection>(cc => cc.CableId) // CableConnection.CableId as FK
                .OnDelete(DeleteBehavior.Cascade);            // Delete Cable → delete related CableConnection

            // Define many-to-one relationship between CableConnection and FromPort
            // Multiple cable connections can reference the same source port
            modelBuilder.Entity<CableConnection>()
                .HasOne(cc => cc.FromPort)                   // CableConnection has one FromPort
                .WithMany()                                  // A Port can be referenced by multiple CableConnections
                .HasForeignKey(cc => cc.FromPortId)          // FromPortId as FK
                .OnDelete(DeleteBehavior.Cascade);           // Deleting Port also deletes related CableConnections

            // Define many-to-one relationship between CableConnection and ToPort
            modelBuilder.Entity<CableConnection>()
                .HasOne(cc => cc.ToPort)
                .WithMany()
                .HasForeignKey(cc => cc.ToPortId)
                .OnDelete(DeleteBehavior.Cascade);

            // Define Rack ↔ Device relationship (primarily for switches)
            modelBuilder.Entity<Rack>()
                .HasMany(r => r.Devices)
                .WithOne(d => d.Rack)
                .HasForeignKey(d => d.RackId)
                .OnDelete(DeleteBehavior.SetNull);

            // Forward 1:1 (Port.Connection → CableConnection.FromPort)
            modelBuilder.Entity<Port>()
                .HasOne(p => p.Connection)
                .WithOne(c => c.FromPort)
                .HasForeignKey<CableConnection>(c => c.FromPortId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
