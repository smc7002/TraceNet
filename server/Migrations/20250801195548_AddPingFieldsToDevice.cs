using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace server.Migrations
{
    /// <inheritdoc />
    public partial class AddPingFieldsToDevice : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Ports_CableConnections_ConnectionCableConnectionId",
                table: "Ports");

            migrationBuilder.DropIndex(
                name: "IX_Ports_ConnectionCableConnectionId",
                table: "Ports");

            migrationBuilder.DropIndex(
                name: "IX_CableConnections_FromPortId",
                table: "CableConnections");

            migrationBuilder.AddColumn<bool>(
                name: "EnablePing",
                table: "Devices",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<DateTime>(
                name: "LastCheckedAt",
                table: "Devices",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<long>(
                name: "LatencyMs",
                table: "Devices",
                type: "bigint",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Devices",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_CableConnections_FromPortId",
                table: "CableConnections",
                column: "FromPortId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_CableConnections_FromPortId",
                table: "CableConnections");

            migrationBuilder.DropColumn(
                name: "EnablePing",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "LastCheckedAt",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "LatencyMs",
                table: "Devices");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Devices");

            migrationBuilder.CreateIndex(
                name: "IX_Ports_ConnectionCableConnectionId",
                table: "Ports",
                column: "ConnectionCableConnectionId");

            migrationBuilder.CreateIndex(
                name: "IX_CableConnections_FromPortId",
                table: "CableConnections",
                column: "FromPortId");

            migrationBuilder.AddForeignKey(
                name: "FK_Ports_CableConnections_ConnectionCableConnectionId",
                table: "Ports",
                column: "ConnectionCableConnectionId",
                principalTable: "CableConnections",
                principalColumn: "CableConnectionId");
        }
    }
}
