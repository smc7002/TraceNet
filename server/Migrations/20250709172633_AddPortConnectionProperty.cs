using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class AddPortConnectionProperty : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Devices_Racks_RackId",
                table: "Devices");

            migrationBuilder.AddColumn<int>(
                name: "ConnectionCableConnectionId",
                table: "Ports",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Ports_ConnectionCableConnectionId",
                table: "Ports",
                column: "ConnectionCableConnectionId");

            migrationBuilder.AddForeignKey(
                name: "FK_Devices_Racks_RackId",
                table: "Devices",
                column: "RackId",
                principalTable: "Racks",
                principalColumn: "RackId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Ports_CableConnections_ConnectionCableConnectionId",
                table: "Ports",
                column: "ConnectionCableConnectionId",
                principalTable: "CableConnections",
                principalColumn: "CableConnectionId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Devices_Racks_RackId",
                table: "Devices");

            migrationBuilder.DropForeignKey(
                name: "FK_Ports_CableConnections_ConnectionCableConnectionId",
                table: "Ports");

            migrationBuilder.DropIndex(
                name: "IX_Ports_ConnectionCableConnectionId",
                table: "Ports");

            migrationBuilder.DropColumn(
                name: "ConnectionCableConnectionId",
                table: "Ports");

            migrationBuilder.AddForeignKey(
                name: "FK_Devices_Racks_RackId",
                table: "Devices",
                column: "RackId",
                principalTable: "Racks",
                principalColumn: "RackId");
        }
    }
}
