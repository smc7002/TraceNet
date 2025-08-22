using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class FixDeleteBehavior : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CableConnections_Ports_ToPortId",
                table: "CableConnections");

            migrationBuilder.DropForeignKey(
                name: "FK_Devices_Racks_RackId",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "IsActive",
                table: "Ports");

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Devices",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AlterColumn<string>(
                name: "IPAddress",
                table: "Devices",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)",
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_CableConnections_Ports_ToPortId",
                table: "CableConnections",
                column: "ToPortId",
                principalTable: "Ports",
                principalColumn: "PortId",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Devices_Racks_RackId",
                table: "Devices",
                column: "RackId",
                principalTable: "Racks",
                principalColumn: "RackId",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_CableConnections_Ports_ToPortId",
                table: "CableConnections");

            migrationBuilder.DropForeignKey(
                name: "FK_Devices_Racks_RackId",
                table: "Devices");

            migrationBuilder.AddColumn<bool>(
                name: "IsActive",
                table: "Ports",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AlterColumn<string>(
                name: "Status",
                table: "Devices",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(16)",
                oldMaxLength: 16);

            migrationBuilder.AlterColumn<string>(
                name: "IPAddress",
                table: "Devices",
                type: "nvarchar(max)",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(64)",
                oldMaxLength: 64,
                oldNullable: true);

            migrationBuilder.AddForeignKey(
                name: "FK_CableConnections_Ports_ToPortId",
                table: "CableConnections",
                column: "ToPortId",
                principalTable: "Ports",
                principalColumn: "PortId",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_Devices_Racks_RackId",
                table: "Devices",
                column: "RackId",
                principalTable: "Racks",
                principalColumn: "RackId",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
