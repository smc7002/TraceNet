using AutoMapper;
using TraceNet.Models;
using TraceNet.DTOs;

namespace TraceNet.DTOs
{
    public class DeviceProfile : Profile
    {
        public DeviceProfile()
        {
            // Device → DeviceDto
            // CreateMap<Device, DeviceDto>()
            //    .ForMember(dest => dest.RackName, opt => opt.MapFrom(src => src.Rack.Name));
            CreateMap<Device, DeviceDto>()
                .ForMember(d => d.RackName, o => o.MapFrom(s => s.Rack != null ? s.Rack.Name : null))
                .ForMember(d => d.IpAddress, o => o.MapFrom(s => s.IPAddress))
                .ForMember(d => d.Status, o => o.MapFrom(s => s.Status))
                .ForMember(d => d.LatencyMs, o => o.MapFrom(s => s.LatencyMs))
                .ForMember(d => d.LastCheckedAt, o => o.MapFrom(s => s.LastCheckedAt))
                .ForMember(d => d.EnablePing, o => o.MapFrom(s => s.EnablePing));

            // CreateDeviceDto → Device
            CreateMap<CreateDeviceDto, Device>();

            // Port → PortDto
            CreateMap<Port, PortDto>();

            // CableConnection → ConnectionDto
            CreateMap<CableConnection, ConnectionDto>()
                .ForMember(dest => dest.ToDeviceId,
                    opt => opt.MapFrom(src => src.ToPort != null ? src.ToPort.DeviceId : (int?)null));

            // Cable → CableDto 
            CreateMap<Cable, CableDto>()
                .ForMember(dest => dest.FromDevice, opt => opt.MapFrom(src => src.Connection!.FromPort.Device.Name))
                .ForMember(dest => dest.FromPort, opt => opt.MapFrom(src => src.Connection!.FromPort.Name))
                .ForMember(dest => dest.ToDevice, opt => opt.MapFrom(src => src.Connection!.ToPort.Device.Name))
                .ForMember(dest => dest.ToPort, opt => opt.MapFrom(src => src.Connection!.ToPort.Name));
        }
    }

}
